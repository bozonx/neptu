import type { Plugin } from '~/types/plugin'

export const contentTypesPlugin: Plugin = {
  manifest: {
    id: 'com.neptu.content-types',
    name: 'Content Types',
    version: '1.0.0',
    description: 'Registers common static-site content structures (Astro, Nuxt, Docusaurus, VitePress, Hugo, Jekyll, Eleventy).',
  },
  activate(ctx) {
    const structures = [
      {
        id: 'astro-content',
        label: 'Astro Content',
        descriptionKey: 'vault.contentStructureAstroDesc',
        order: 10,
        config: {
          version: 1,
          contentRoot: 'src/content',
          mediaDir: {
            mode: 'global-folder' as const,
            folder: 'public/media',
            naming: 'document-index' as const,
          },
          excludes: ['node_modules', 'dist', '.astro'],
        },
      },
      {
        id: 'nuxt-content',
        label: 'Nuxt Content',
        descriptionKey: 'vault.contentStructureNuxtContentDesc',
        order: 20,
        config: {
          version: 1,
          contentRoot: 'content',
          mediaDir: {
            mode: 'global-folder' as const,
            folder: 'public/media',
            naming: 'document-index' as const,
          },
          excludes: ['node_modules', '.nuxt', '.output'],
        },
      },
      {
        id: 'docusaurus',
        label: 'Docusaurus',
        descriptionKey: 'vault.contentStructureDocusaurusDesc',
        order: 30,
        config: {
          version: 1,
          mediaDir: {
            mode: 'global-folder' as const,
            folder: 'static/img',
            naming: 'document-index' as const,
          },
          excludes: ['node_modules', 'build', '.docusaurus'],
        },
      },
      {
        id: 'vitepress-mono',
        label: 'VitePress (Monolingual)',
        descriptionKey: 'vault.contentStructureVitepressMonoDesc',
        order: 35,
        config: {
          version: 1,
          contentRoot: 'src',
          mediaDir: {
            mode: 'global-folder' as const,
            folder: 'src/public/media',
            naming: 'document-index' as const,
          },
          excludes: ['node_modules', 'dist', '.vitepress'],
        },
      },
      {
        id: 'vitepress-multi',
        label: 'VitePress (Multilingual)',
        descriptionKey: 'vault.contentStructureVitepressMultiDesc',
        order: 36,
        config: {
          version: 1,
          contentRoot: 'src',
          mediaDir: {
            mode: 'global-folder' as const,
            folder: 'src/public/media',
            naming: 'document-index' as const,
          },
          excludes: ['node_modules', 'dist', '.vitepress'],
        },
      },
      {
        id: 'hugo',
        label: 'Hugo',
        descriptionKey: 'vault.contentStructureHugoDesc',
        order: 40,
        config: {
          version: 1,
          contentRoot: 'content',
          mediaDir: {
            mode: 'global-folder' as const,
            folder: 'static/media',
            naming: 'document-index' as const,
          },
          excludes: ['public', 'resources', 'node_modules'],
        },
      },
      {
        id: 'jekyll',
        label: 'Jekyll',
        descriptionKey: 'vault.contentStructureJekyllDesc',
        order: 50,
        config: {
          version: 1,
          mediaDir: {
            mode: 'global-folder' as const,
            folder: 'assets/media',
            naming: 'document-index' as const,
          },
          excludes: ['_site', '.jekyll-cache', 'vendor', 'node_modules'],
        },
      },
      {
        id: 'eleventy',
        label: 'Eleventy',
        descriptionKey: 'vault.contentStructureEleventyDesc',
        order: 60,
        config: {
          version: 1,
          contentRoot: 'src',
          mediaDir: {
            mode: 'global-folder' as const,
            folder: 'src/assets/media',
            naming: 'document-index' as const,
          },
          excludes: ['_site', 'node_modules'],
        },
      },
    ]

    const disposes = structures.map((s) => ctx.api.content.addStructure(s))

    ctx.onUnload(() => {
      for (const dispose of disposes) {
        dispose()
      }
    })
  },
}
