<script>
  //import "/src/fonts.css";
  import "/src/app.scss";
</script>

<div class="app">
 

  <main>
    <slot />
  </main>

</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  /* main {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    margin: 0 auto;
    box-sizing: border-box;
  } */

</style>
