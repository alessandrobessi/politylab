<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>PolityLab — Emergent States</title>
</svelte:head>

{@render children()}
