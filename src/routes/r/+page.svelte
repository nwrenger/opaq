<script lang="ts">
	import { page } from '$app/state';
	import { decode, PASSWORD_PREFIX } from '$lib/brotli';
	import { onMount } from 'svelte';

	let encoded = $state('');
	let password = $state('');
	let needsPassword = $state(false);
	let decoding = $state(false);
	let invalidLink = $state(false);
	let incorrectPassword = $state(false);

	async function redirectToDecoded(data: string, passwordValue?: string) {
		decoding = true;

		try {
			const decoded = await decode(data, passwordValue);
			window.location.href = decoded;
		} catch (err) {
			decoding = false;

			if (needsPassword) {
				incorrectPassword = true;
			} else {
				invalidLink = true;
			}
		}
	}

	async function unlock(event?: SubmitEvent) {
		incorrectPassword = false;
		event?.preventDefault();
		const passwordValue = password;
		if (!password.trim()) {
			incorrectPassword = true;
			return;
		}

		await redirectToDecoded(encoded, passwordValue);
	}

	onMount(() => {
		const key = page.url.searchParams.keys().next().value;
		if (!key) return;

		encoded = key;
		if (key.startsWith(PASSWORD_PREFIX)) {
			needsPassword = true;
			return;
		}

		void redirectToDecoded(key);
	});
</script>

<svelte:head>
	<title>Redirecting - opaq | Obfuscate, Compress & Secure URLs</title>
	<meta name="description" content="Redirecting to the original URL." />
	<!-- Open Graph -->
	<meta property="og:title" content="Redirecting - opaq | Obfuscate, Compress & Secure URLs" />
	<meta property="og:description" content="Redirecting to the original URL." />
</svelte:head>

<div class="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 py-10">
	<div class="w-full card preset-tonal p-6 text-center">
		{#if !encoded || invalidLink}
			<div class="space-y-2">
				<h5 class="h5 text-surface-950-50">Invalid link</h5>
				<p class="text-sm text-surface-700-300">We could not find a valid encoded URL to decode.</p>
			</div>
		{:else if needsPassword}
			<div class="space-y-3">
				<h5 class="h5 text-surface-950-50">Password required</h5>
				<p class="text-sm text-surface-700-300">
					Enter the password to unlock this protected link.
				</p>
				<form class="space-y-3" onsubmit={unlock} aria-describedby="helper">
					<label class="label space-y-2 text-start">
						<input
							class="input text-surface-950-50"
							type="password"
							autocomplete="current-password"
							placeholder="Password"
							pattern="^\S+$"
							required
							bind:value={password}
						/>
						{#if incorrectPassword}
							<span class="label-text text-error-500">Incorrect Password</span>
						{/if}
					</label>
					<button type="submit" class="btn w-full preset-filled" disabled={decoding}>
						{#if decoding}
							Unlocking...
						{:else}
							Unlock & Redirect
						{/if}
					</button>
				</form>
			</div>
		{:else}
			<div>
				<div
					class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-surface-500/40 border-t-primary-500"
				></div>
				<h5 class="h5 text-surface-950-50">Redirecting...</h5>
				<p class="mt-2 text-sm text-surface-700-300">
					Hang tight. We are opening the decoded link.
				</p>
			</div>
		{/if}
	</div>
</div>
