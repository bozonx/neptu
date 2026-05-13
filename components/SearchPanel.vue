<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import type { SearchResult } from "~/stores/search";

const search = useSearchStore();
const tabs = useTabsStore();
const { t } = useI18n();

const query = ref("");
const debouncedQuery = ref("");

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(query, (val) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        debouncedQuery.value = val;
    }, 200);
});

onBeforeUnmount(() => {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
});

const results = computed(() => {
    if (!debouncedQuery.value.trim()) return [];
    return search.search(debouncedQuery.value);
});

const groupedResults = computed(() => {
    const map = new Map<
        string,
        { vaultName: string; results: SearchResult[] }
    >();
    for (const r of results.value) {
        const group = map.get(r.doc.vaultId);
        if (!group) {
            map.set(r.doc.vaultId, {
                vaultName: r.doc.vaultName,
                results: [r],
            });
        } else {
            group.results.push(r);
        }
    }
    return [...map.values()];
});

onMounted(() => {
    if (search.docs.size === 0) {
        search.buildIndex();
    }
});

function openResult(path: string) {
    void tabs.openFile(path);
}

function highlightSnippets(snippet: string, terms: string[]): string {
    let html = snippet;
    for (const term of terms) {
        if (!term) continue;
        const re = new RegExp(`(${escapeRegExp(term)})`, "gi");
        html = html.replace(re, "<mark>$1</mark>");
    }
    return html;
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const searchTerms = computed(() =>
    debouncedQuery.value.toLowerCase().trim().split(/\s+/).filter(Boolean),
);
</script>

<template>
    <div class="flex flex-col h-full">
        <div class="p-2 border-b border-default shrink-0">
            <UInput
                v-model="query"
                :placeholder="t('search.placeholder')"
                icon="i-lucide-search"
                autofocus
            />
        </div>

        <div
            v-if="search.isIndexing"
            class="flex-1 flex items-center justify-center gap-2 text-sm text-muted"
        >
            <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
            {{ t("search.indexing") }}
        </div>

        <div
            v-else-if="search.indexError"
            class="flex-1 flex items-center justify-center text-sm text-error px-4 text-center"
        >
            {{ search.indexError }}
        </div>

        <div
            v-else-if="!debouncedQuery.trim()"
            class="flex-1 flex items-center justify-center text-sm text-muted px-4 text-center"
        >
            {{ t("search.startTyping") }}
        </div>

        <div
            v-else-if="groupedResults.length === 0"
            class="flex-1 flex items-center justify-center text-sm text-muted px-4 text-center"
        >
            {{ t("search.noResults") }}
        </div>

        <div v-else class="flex-1 overflow-auto p-2 space-y-4">
            <div v-for="group in groupedResults" :key="group.vaultName">
                <div
                    class="text-xs font-semibold text-muted uppercase tracking-wider mb-1 px-1"
                >
                    {{ group.vaultName }}
                </div>
                <div class="space-y-1">
                    <div
                        v-for="result in group.results"
                        :key="result.doc.path"
                        class="p-2 rounded-md hover:bg-elevated cursor-pointer transition-colors"
                        @click="openResult(result.doc.path)"
                    >
                        <div
                            class="text-sm font-medium"
                            v-html="
                                highlightSnippets(result.doc.name, searchTerms)
                            "
                        />
                        <div
                            v-if="result.snippets.length"
                            class="mt-1 space-y-0.5"
                        >
                            <div
                                v-for="(snippet, idx) in result.snippets"
                                :key="idx"
                                class="text-xs text-muted line-clamp-2"
                                v-html="highlightSnippets(snippet, searchTerms)"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
