<script lang="ts">
	import { page } from '$app/state';
	import { encode } from '$lib/brotli';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import { ClipboardCheck, Clipboard } from 'lucide-svelte';

	async function shorten() {
		const trimmed = url.trim();
		if (!trimmed) {
			shortenUrl = '';
			return;
		}

		const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
		let result = await encode(normalized);

		shortenUrl = `${page.url.origin}/s?${result}`;
	}

	let url = $state('');
	let shortenUrl = $state('');
</script>

<svelte:head>
	<title>short | Shorten & Obfuscate URLs</title>
	<meta name="description" content="Shorten and obfuscate URLs into compact, opaque links." />
	<!-- Open Graph -->
	<meta property="og:title" content="short | Shorten & Obfuscate URLs" />
	<meta
		property="og:description"
		content="Shorten and obfuscate URLs into compact, opaque links."
	/>
</svelte:head>

<div class="mx-auto h-full max-w-3xl px-4 py-10">
	<div class="grid gap-10">
		<div class="space-y-8">
			<header class="space-y-4">
				<div class="space-y-2">
					<h1 class="h1">short</h1>
					<p class="text-sm text-surface-700-300 sm:text-base">
						Shorten and obfuscate URLs into compact, opaque links. Everything happens in your
						browser for instant, private, and secure results.
					</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<span class="badge preset-tonal text-surface-950-50">Opaque output</span>
					<span class="badge preset-tonal text-surface-950-50">Client-side encoding</span>
					<span class="badge preset-tonal text-surface-950-50">Fast redirect</span>
				</div>
			</header>
			<section class="space-y-6 card preset-tonal p-6">
				<form class="space-y-6" onsubmit={shorten} aria-describedby="helper">
					<label class="label space-y-2">
						<span class="label-text flex items-center justify-between text-surface-950-50">
							<span>URL</span>
							<span>
								press <kbd class="kbd text-xs text-surface-950-50">↵</kbd> to confirm
							</span>
						</span>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							class="input text-surface-950-50"
							type="text"
							autocomplete="url"
							autofocus
							required
							placeholder="Paste URL to shorten and obfuscate..."
							bind:value={url}
						/>
						<span class="label-text text-surface-700-300">
							Supports full URLs or bare domains. We auto-add <code class="code">https://</code> when
							missing.
						</span>
					</label>
					<div class="flex flex-wrap items-center gap-3">
						<button type="submit" class="btn preset-filled sm:w-auto"> Shorten & Obfuscate </button>
						<p class="text-xs text-surface-700-300">Compact, readable, and ready to share.</p>
					</div>
				</form>
				<div class="input-group grid-cols-[1fr_auto]">
					<input
						readonly
						class="ig-input text-surface-950-50"
						type="text"
						placeholder="Empty"
						bind:value={shortenUrl}
					/>
					<CopyButton text={shortenUrl} class="ig-btn preset-filled">
						{#snippet child({ copied })}
							{#if copied}
								<ClipboardCheck class="mr-2 size-4" />
								<span class="block">Copied</span>
							{:else}
								<Clipboard class="mr-2 size-4" />
								<span>Copy</span>
							{/if}
						{/snippet}
					</CopyButton>
				</div>
			</section>

			<div class="text-center text-xs">
				<a href="https://nwrenger.dev/privacy-policy" class="anchor">Privacy Policy</a>
			</div>
		</div>
	</div>
</div>
