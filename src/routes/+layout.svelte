<script lang="ts">
	import '../app.css';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';

	let { children } = $props();

	injectSpeedInsights();
	injectAnalytics();
</script>

{@render children()}
