<script lang="ts">
	import { page } from '$app/state';
	import { encode, textEncoder } from '$lib/brotli';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import { sanitizeUrl } from '$lib/sanitizeUrl';
	import { ClipboardCheck, Clipboard, Github, ExternalLink } from 'lucide-svelte';
	import { Tabs } from '@skeletonlabs/skeleton-svelte';

	function formatCompression(original: string, encoded: string): string {
		const originalBytes = textEncoder.encode(original).length;
		const encodedBytes = textEncoder.encode(encoded).length;
		if (!originalBytes || !encodedBytes) return '';

		const delta = ((originalBytes - encodedBytes) / originalBytes) * 100;
		if (!Number.isFinite(delta)) return '';

		const magnitude = Math.abs(delta);
		const formatted = magnitude < 1 ? magnitude.toFixed(1) : Math.round(magnitude).toString();
		return delta >= 0 ? `${formatted}% smaller` : `${formatted}% larger`;
	}

	async function generateLink() {
		const trimmed = url.trim();
		if (!trimmed) {
			generatedUrl = '';
			compressionSummary = '';
			return;
		}

		const sanitized = sanitizeUrl(trimmed);
		const usePassword = mode === 'protected';
		let result = await encode(sanitized, usePassword ? password : undefined);

		generatedUrl = `${page.url.origin}/r?${result}`;
		compressionSummary = formatCompression(sanitized, result);
	}

	let url = $state('');
	let password = $state('');
	let generatedUrl = $state('');
	let compressionSummary = $state('');
	let mode = $state('standard');
</script>

<svelte:head>
	<title>opaq | Obfuscate, Compress & Secure URLs</title>
	<meta
		name="description"
		content="Obfuscate, compress, and secure URLs into compact, opaque links."
	/>
	<!-- Open Graph -->
	<meta property="og:title" content="opaq | Obfuscate, Compress & Secure URLs" />
	<meta
		property="og:description"
		content="Obfuscate, compress, and secure URLs into compact, opaque links."
	/>
</svelte:head>

<div class="mx-auto h-full w-full max-w-3xl px-4 py-10">
	<div class="grid gap-10">
		<div class="space-y-8">
			<header class="space-y-4">
				<div class="space-y-2">
					<h1 class="h1">opaq</h1>
					<p class="text-sm text-surface-700-300 sm:text-base">
						Obfuscate, compress, and secure URLs into compact, opaque links. Everything happens in
						your browser for instant, private, and secure results.
					</p>
				</div>
				<div class="flex w-full flex-wrap items-center justify-between gap-3">
					<a
						href="https://github.com/nwrenger/clash"
						target="_blank"
						class="btn h-9 preset-tonal text-surface-950-50"
					>
						<Github size={18} />
						Star on GitHub
						<ExternalLink size={16} class="opacity-60" />
					</a>

					<ul class="flex flex-wrap items-center gap-2">
						<li class="badge preset-tonal text-surface-950-50">Opaque output</li>
						<li class="badge preset-tonal text-surface-950-50">Client-side encoding</li>
						<li class="badge preset-tonal text-surface-950-50">Fast redirect</li>
					</ul>
				</div>
			</header>
			<section class="space-y-6 card preset-tonal p-6">
				<Tabs value={mode} onValueChange={(details) => (mode = details.value)}>
					<Tabs.List class="whitespace-nowrap">
						<Tabs.Trigger
							class="flex-1 bg-transparent text-surface-950-50 brightness-100 hover:opacity-75"
							value="standard"
						>
							Standard
						</Tabs.Trigger>
						<Tabs.Trigger
							class="flex-1 bg-transparent text-surface-950-50 brightness-100 hover:opacity-75"
							value="protected"
						>
							Protected
						</Tabs.Trigger>
						<Tabs.Indicator />
					</Tabs.List>
					<Tabs.Content value="standard">
						<form class="space-y-6" onsubmit={generateLink} aria-describedby="helper">
							<label class="label space-y-2">
								<span class="label-text text-surface-950-50"> URL </span>
								<input
									class="input text-surface-950-50"
									type="url"
									autocomplete="url"
									required
									placeholder="Paste URL to obfuscate and compress..."
									bind:value={url}
								/>
								<span class="label-text text-surface-700-300">
									Only supports full URLs requiring <code class="code">http://</code> or
									<code class="code">https://</code>. Tracking parameters (utm, fbclid, etc.) are
									removed automatically.
								</span>
							</label>
							<div class="flex flex-wrap items-center gap-3">
								<button type="submit" class="btn preset-filled sm:w-auto">Generate link</button>
								<p class="text-xs text-surface-700-300">Fast, simple, and ready to share.</p>
							</div>
						</form>
					</Tabs.Content>
					<Tabs.Content value="protected">
						<form class="space-y-6" onsubmit={generateLink} aria-describedby="helper">
							<label class="label space-y-2">
								<span class="label-text text-surface-950-50"> URL </span>
								<input
									class="input text-surface-950-50"
									type="url"
									autocomplete="url"
									required
									placeholder="Paste URL to obfuscate, compress and protect..."
									bind:value={url}
								/>
								<span class="label-text text-surface-700-300">
									Only supports full URLs requiring <code class="code">http://</code> or
									<code class="code">https://</code>. Tracking parameters (utm, fbclid, etc.) are
									removed automatically.
								</span>
							</label>
							<label class="label space-y-2">
								<span class="label-text text-surface-950-50">Password</span>
								<input
									class="input text-surface-950-50"
									type="password"
									pattern="^\S+$"
									required
									placeholder="Add a password to protect this link..."
									bind:value={password}
								/>
								<span class="label-text text-surface-700-300">
									Anyone opening the protected link will need this password.
								</span>
							</label>
							<div class="space-y-2 text-xs text-surface-700-300">
								<p class="text-surface-950-50">Encryption</p>
								<p>AES-GCM 256-bit with PBKDF2 (SHA-256, 100k iterations).</p>
							</div>
							<div class="flex flex-wrap items-center gap-3">
								<button type="submit" class="btn preset-filled sm:w-auto">
									Generate protected link
								</button>
								<p class="text-xs text-surface-700-300">Encrypted, private, and safe to share.</p>
							</div>
						</form>
					</Tabs.Content>
				</Tabs>
				<label class="label space-y-2">
					<span class="label-text flex items-center justify-between text-surface-950-50">
						<span class="flex flex-col gap-1">
							<span class="flex items-center gap-2">
								<span>Generated URL</span>
							</span>
							<span class="text-xs text-surface-700-300"
								>Compression: {compressionSummary || 'None'}</span
							>
						</span>
						{#if generatedUrl}
							<a class="anchor" href={generatedUrl} target="_blank" rel="noreferrer">
								Open in new tab
							</a>
						{/if}
					</span>
					<div class="input-group grid-cols-[1fr_auto]">
						<input
							readonly
							class="ig-input font-mono text-sm text-surface-950-50"
							type="text"
							placeholder="Your cloaked link will appear here..."
							bind:value={generatedUrl}
						/>
						<CopyButton text={generatedUrl} class="ig-btn preset-filled" disabled={!generatedUrl}>
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
				</label>
			</section>

			<div class="text-center text-xs">
				<a href="https://nwrenger.dev/privacy-policy" class="anchor">Privacy Policy</a>
			</div>
		</div>
	</div>
</div>
