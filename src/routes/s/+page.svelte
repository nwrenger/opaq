<script lang="ts">
	import { page } from '$app/state';
	import { decode } from '$lib/brotli';
	import { onMount } from 'svelte';

	onMount(async () => {
		const s = page.url.searchParams.keys().next().value;
		if (!s) return;

		const decoded = await decode(s);

		window.location.href = decoded;
	});
</script>

<svelte:head>
	<title>Redirecting - short | Shorten & Obfuscate URLs</title>
	<meta name="description" content="Redirecting to the original URL." />
	<!-- Open Graph -->
	<meta property="og:title" content="Redirecting - short | Shorten & Obfuscate URLs" />
	<meta property="og:description" content="Redirecting to the original URL." />
</svelte:head>

<div class="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 py-10">
	<div class="w-full card preset-tonal p-6 text-center">
		<div
			class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-surface-500/40 border-t-primary-500"
		></div>
		<h5 class="h5 text-surface-950-50">Redirecting...</h5>
		<p class="mt-2 text-sm text-surface-700-300">Hang tight. We are opening the decoded link.</p>
	</div>
</div>
