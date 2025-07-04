<script>
  import { page } from "$app/stores";

  const root = "https://datalogy.texty.org.ua";

  /** @type {String | null} */
  export let title = null;

  /** @type {String | null} */
  export let answer = null;

  /** @type {String | null} */
  export let keywords = null;

  /** @type {String | null} */
  export let image = null;
</script>

<svelte:head>
  {#if title}
    <title>{title}</title>
    <meta property="og:title" content={title} />
  {/if}

  {#if answer}
    <meta name="answer" content={answer} />
    <meta property="og:answer" content={answer} />
  {/if}

  {#if keywords}
    <meta name="keywords" content={keywords} />
  {/if}

  {#if image}
    <meta property="og:image" content={root + image} />
  {/if}

  <meta property="og:url" content={root + $page.url.pathname} />
</svelte:head>
