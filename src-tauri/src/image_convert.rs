use std::{fs, path::Path};

use image::{
    codecs::{jpeg::JpegEncoder, png::PngEncoder},
    imageops::FilterType,
    ImageDecoder, ImageEncoder, ImageFormat, ImageReader, Rgba, RgbaImage,
};
use little_exif::{filetype::FileExtension, ifd::ExifTagGroup, metadata::Metadata};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertImageOptions {
    format: String,
    quality: Option<f32>,
    max_dimension: Option<u32>,
    background_color: Option<String>,
    preserve_transparency: bool,
    preserve_exif: bool,
}

fn target_ext(format: &str) -> Result<&'static str, String> {
    match format {
        "webp" => Ok(".webp"),
        "jpeg" => Ok(".jpg"),
        "png" => Ok(".png"),
        _ => Err(format!("unsupported image format: {format}")),
    }
}

fn quality_u8(quality: Option<f32>) -> u8 {
    let quality = quality.unwrap_or(0.85).clamp(0.0, 1.0);
    (quality * 100.0).round().clamp(1.0, 100.0) as u8
}

fn quality_f32(quality: Option<f32>) -> f32 {
    let quality = quality.unwrap_or(0.85).clamp(0.0, 1.0);
    (quality * 100.0).clamp(1.0, 100.0)
}

fn parse_hex_color(value: Option<&str>) -> Rgba<u8> {
    let raw = value.unwrap_or("#ffffff").trim().trim_start_matches('#');
    if raw.len() != 6 {
        return Rgba([255, 255, 255, 255]);
    }

    let parse = |range: std::ops::Range<usize>| u8::from_str_radix(&raw[range], 16).unwrap_or(255);

    Rgba([parse(0..2), parse(2..4), parse(4..6), 255])
}

fn image_has_alpha(image: &RgbaImage) -> bool {
    image.pixels().any(|pixel| pixel.0[3] < 255)
}

fn flatten_alpha(image: &RgbaImage, background: Rgba<u8>) -> RgbaImage {
    let mut output = RgbaImage::new(image.width(), image.height());
    for (x, y, pixel) in image.enumerate_pixels() {
        let alpha = pixel.0[3] as u16;
        let inverse = 255 - alpha;
        let blend = |channel: usize| {
            ((pixel.0[channel] as u16 * alpha + background.0[channel] as u16 * inverse) / 255) as u8
        };
        output.put_pixel(x, y, Rgba([blend(0), blend(1), blend(2), 255]));
    }
    output
}

fn read_oriented_rgba(path: &Path, apply_orientation: bool) -> Result<RgbaImage, String> {
    let format =
        ImageFormat::from_path(path).map_err(|_| "unsupported source image format".to_string())?;
    let orientation = if apply_orientation {
        let mut orientation_reader = ImageReader::open(path).map_err(|e| e.to_string())?;
        orientation_reader.set_format(format);
        orientation_reader
            .into_decoder()
            .and_then(|mut decoder| decoder.orientation())
            .ok()
    } else {
        None
    };

    let mut reader = ImageReader::open(path).map_err(|e| e.to_string())?;
    reader.set_format(format);
    let mut image = reader.decode().map_err(|e| e.to_string())?;
    if let Some(orientation) = orientation {
        image.apply_orientation(orientation);
    }
    Ok(image.to_rgba8())
}

fn resize_if_needed(image: RgbaImage, max_dimension: Option<u32>) -> (RgbaImage, bool) {
    let Some(max_dimension) = max_dimension.filter(|value| *value > 0) else {
        return (image, false);
    };

    let max_side = image.width().max(image.height());
    if max_side <= max_dimension {
        return (image, false);
    }

    let scale = max_dimension as f32 / max_side as f32;
    let width = ((image.width() as f32 * scale).round() as u32).max(1);
    let height = ((image.height() as f32 * scale).round() as u32).max(1);
    (
        image::imageops::resize(&image, width, height, FilterType::Lanczos3),
        true,
    )
}

fn will_resize(path: &Path, max_dimension: Option<u32>) -> bool {
    let Some(max_dimension) = max_dimension.filter(|value| *value > 0) else {
        return false;
    };

    image::image_dimensions(path)
        .map(|(width, height)| width.max(height) > max_dimension)
        .unwrap_or(false)
}

fn encode_image(image: &RgbaImage, options: &ConvertImageOptions) -> Result<Vec<u8>, String> {
    let mut output = Vec::new();
    match options.format.as_str() {
        "jpeg" => {
            let rgb = image::DynamicImage::ImageRgba8(image.clone()).to_rgb8();
            JpegEncoder::new_with_quality(&mut output, quality_u8(options.quality))
                .encode_image(&rgb)
                .map_err(|e| e.to_string())?;
        }
        "png" => {
            PngEncoder::new(&mut output)
                .write_image(
                    image.as_raw(),
                    image.width(),
                    image.height(),
                    image::ExtendedColorType::Rgba8,
                )
                .map_err(|e| e.to_string())?;
        }
        "webp" => {
            let encoder = webp::Encoder::from_rgba(image.as_raw(), image.width(), image.height());
            let encoded = encoder.encode(quality_f32(options.quality));
            output.extend_from_slice(&encoded);
        }
        _ => return Err(format!("unsupported image format: {}", options.format)),
    }
    Ok(output)
}

fn file_extension_for_exif(format: &str) -> Option<FileExtension> {
    match format {
        "jpeg" => Some(FileExtension::JPEG),
        "webp" => Some(FileExtension::WEBP),
        _ => None,
    }
}

fn read_source_metadata(path: &Path) -> Option<Metadata> {
    Metadata::new_from_path(path).ok()
}

fn strip_size_and_orientation_tags(metadata: &mut Metadata) {
    metadata.remove_tag_by_hex_group(0x0100, ExifTagGroup::GENERIC);
    metadata.remove_tag_by_hex_group(0x0101, ExifTagGroup::GENERIC);
    metadata.remove_tag_by_hex_group(0x0112, ExifTagGroup::GENERIC);
    metadata.remove_tag_by_hex_group(0xa002, ExifTagGroup::EXIF);
    metadata.remove_tag_by_hex_group(0xa003, ExifTagGroup::EXIF);
}

fn maybe_write_exif(
    bytes: &mut Vec<u8>,
    source_path: &Path,
    options: &ConvertImageOptions,
    resized: bool,
) -> Result<(), String> {
    if !options.preserve_exif {
        return Ok(());
    }

    let Some(target_file_type) = file_extension_for_exif(&options.format) else {
        return Ok(());
    };

    let Some(mut metadata) = read_source_metadata(source_path) else {
        return Ok(());
    };

    if resized {
        strip_size_and_orientation_tags(&mut metadata);
    }

    metadata
        .write_to_vec(bytes, target_file_type)
        .map_err(|e| e.to_string())
}

fn convert_image_impl(
    source_path: &Path,
    target_path: &Path,
    options: &ConvertImageOptions,
) -> Result<(), String> {
    target_ext(&options.format)?;

    let apply_orientation = options.format == "png"
        || !options.preserve_exif
        || will_resize(source_path, options.max_dimension);
    let (source, resized) = resize_if_needed(
        read_oriented_rgba(source_path, apply_orientation)?,
        options.max_dimension,
    );
    let needs_background =
        options.format == "jpeg" || (!options.preserve_transparency && image_has_alpha(&source));
    let image = if needs_background {
        flatten_alpha(
            &source,
            parse_hex_color(options.background_color.as_deref()),
        )
    } else {
        source
    };

    let mut bytes = encode_image(&image, options)?;
    maybe_write_exif(&mut bytes, source_path, options, resized)?;
    fs::write(target_path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn convert_image(
    source_path: String,
    target_path: String,
    options: ConvertImageOptions,
) -> Result<(), String> {
    convert_image_impl(Path::new(&source_path), Path::new(&target_path), &options)
}
