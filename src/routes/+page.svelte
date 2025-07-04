<script>
  import { browser } from '$app/environment';
  // Імпорт компонентів різних частин дашборду
  import TimelineChart from '$lib/components/TimelineChart.svelte';
  import Questions from '$lib/components/Questions.svelte';
  import QuestionsTop from '$lib/components/QuestionsTop.svelte';
  import Filter from '$lib/components/Filter.svelte';
  import Map from '$lib/components/Map.svelte';
  // Імпорт даних та функцій зі сховища
  import { surveysRaw, answerStats, calculateStats, priorityQuestions } from "$lib/store.js";

  let innerWidth = $state(0); // Відслітковуємо ширину екрану для динамічної зміни елементів
  let isMobile = $derived(browser && innerWidth <= 800); // Визначення мобільного пристрою

  let FILTERS = $state({}); // Масив активних фільтрів
  let filteredData = $state([]); // Масив відфільтрованих відповідей

  let totalSurveys = $state(0); // Загальна кількість анкет
  let filteredSurveys = $state(0); // Кількість анкет після фільтрації
  let surveyPercentage = $derived(
    totalSurveys > 0 ? Math.round((filteredSurveys / totalSurveys) * 100) : 0
  ); // Кількість відфільтрованих анкет від заг. кіл. у %

  // Стан згортання/розгортання фільтрів для мобілки
  const state = $state({
    isCollapsed: false
  });

  // Підрахунок загальної кількості анкет
  surveysRaw.subscribe(data => {
    totalSurveys = data.length;
  });

  // Підрахунок кількості анкет з фільтрами
  answerStats.subscribe(data => {
    filteredData = data.sort((a, b) => {
      const aIndex = priorityQuestions.indexOf(a.question);
      const bIndex = priorityQuestions.indexOf(b.question);

      // Спочатку відображаємо питання у визначеному порядку [виставляється у store.js в priorityQuestions]
      if (aIndex !== -1 && bIndex !== -1) {
        if (aIndex !== bIndex) {
          return aIndex - bIndex;
        }
        return b.freq - a.freq;
      }
      if (aIndex !== -1) {
        return -1;
      }
      if (bIndex !== -1) {
        return 1;
      }

      // Усі інші сортуємо за алфавітом
      if (a.question !== b.question) {
        return a.question.localeCompare(b.question);
      }

      // Інакше сортувати за частотою (від більшого до меншого)
      return b.freq - a.freq;
    });
  });

  $effect(() => {
    // Фільтрація даних за всіма обраними фільтрами
    const filtered = $surveysRaw.filter(d => 
      Object.entries(FILTERS).every(([key, values]) => {
        // Також враховуємо обраний часовий діапазон
        if (key === 'dateRange') {
          const dateStr = d["Дата заповнення анкети"];
          if (!dateStr || dateStr === "NA") return false;

          const recordDate = new Date(dateStr);
          const startDate = new Date(values.start);
          const endDate = new Date(values.end);

          return recordDate >= startDate && recordDate <= endDate;
        }

        if (Array.isArray(values)) {
          // Якщо фільтр порожній, показуємо усі питання
          if (values.length === 0) return true;
          // Якщо фільтр щось містить, показуємо тільки ті питання, анкети яких містять обрану відповідь в обраному питанні
          // Приклад:
          // Обираємо "Дівчина" у питанні "Стать"
          // У питанні "Вік" тепер показуються тільки ті варіанти віку, які мають жіночу стать
          return values.includes(d[key]);
        }
        return d[key] === values;
      })
    );

    // Оновлення кількості анкет після застосування фільтру
    filteredSurveys = filtered.length;

    const questions = filtered.length > 0 ? Object.keys(filtered[0]) : [];
    const { freqMap } = calculateStats(filtered, {}, questions);

    filteredData.forEach(item => {
      const key = `${item.question}||${item.answer}`;
      item.freq = freqMap.get(key) ?? 0;
    });
  });
</script>

<!-- Відслітковуємо ширину екрану для динамічної зміни елементів -->
<svelte:window bind:innerWidth />

<div class="board">
  <div class="boardContent">
    <h1>Результати ціннісного тесту</h1>

    <section class="mainPage">

      <!-- Мапа -->
      <Map bind:FILTERS/>

      <div class="ver-line"></div>

      <!-- Питання у верхній частині (Вік, Стать) -->
      <QuestionsTop bind:FILTERS/>

      <div class="ver-line"></div>

      <!-- Часовий графік -->
      <TimelineChart bind:FILTERS/>

      <!-- [на мобілці] Кнопка для згортання/розгортання активних фільтрів -->
      <div class="mobileButton">
        <h2>Обрані фільтри</h2>
        <div class="surveys">
          <p class="full">Дані {filteredSurveys} анкет ({surveyPercentage}%)</p>
          <button class="collapse-button" onclick={() => (state.isCollapsed = !state.isCollapsed)}>
            {#if state.isCollapsed}
              <!-- Іконка + для розгортання -->
              <svg viewBox="0 0 25 25" width="25" height="25">
                <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
              </svg>
            {:else}
              <!-- Іконка - для згортання -->
              <svg viewBox="0 0 25 25" width="25" height="25">
                <path d="M19,13H5V11H19V13Z" />
              </svg>
            {/if}
          </button>
        </div>
      </div>

      <!-- [на мобілці] Блок активних фільтрів (показуються тільки якщо елемент розгорнутий) -->
      {#if isMobile && !state.isCollapsed}
        <div class="filter">
          <Filter {filteredData} {isMobile} bind:FILTERS/>
        </div>
      {/if}

      <div class="line full"></div>

      <!-- Статистика для десктопної версії -->
      {#if !isMobile}
        <p class="full">Дані {filteredSurveys} анкет ({surveyPercentage}%)</p>
      {/if}

    </section>

    <!-- Блок з питаннями -->
    <Questions {filteredData} {isMobile} {FILTERS}/>
  </div>

  <!-- Бокова панель з фільтрами для десктопної версії -->
  {#if !isMobile}
    <div class="filter">
      <Filter {filteredData} {isMobile} bind:FILTERS/>
    </div>
  {/if}
</div>

<style>
  h1, h2, p {
    font-family: 'Cy Grotesk';
  }
  h1 {
    font-size: 18px;
    font-weight: 500;
    text-transform: uppercase;
    margin: 10px 0 10px 0;
  }
  h2 {
    font-size: 18px;
    text-transform: uppercase;
  }

  .mainPage {
    background-color: white;
    display: grid;
    grid-template-columns: 1fr 2px 1fr 2px 1.5fr;
    position: sticky;
    top: 0;
    left: 0;
    z-index: 1;
    padding: 5px 0px 5px 0px;
    column-gap: 10px;
    row-gap: 5px;
  }
  .mainPage .full {
    grid-column: 1 / -1;
    font-size: 15px;
  }
  p.full{
    margin: 0 0 5px 0;
  }

  .ver-line {
    border-left: 1.5px solid black; 
    height: 100%;
    align-self: center;
  }
  .line {
    border-bottom: 1.5px solid black; 
    width: 100%;
    margin-top: 5px;
  }

  .board {
    display: grid;
    grid-template-columns: 3fr 1fr;
    grid-column-gap: 10px;
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 10px;
  }

  .filter {
    position: sticky;
    top: 0;
    background-color: #DFDFDF;
    height: 100vh;
    padding: 0 15px;
    overflow-y: auto;
    z-index: 999;
  }

  .collapse-button {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .mobileButton {
    display: none;
    justify-content: space-between;
    grid-column: 1 / -1;
    background-color: #C4C4C4;
    margin: 0 -10px;
    padding: 0 10px;
    align-items: center;
  }

  .surveys {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  @media screen and (max-width: 800px) {
    h1 {
      margin: 0;
      padding: 0px 5px;
    }
    h2 {
      font-size: 13px;
    }

    .mainPage {
      position: relative;
    }

    .full {
      font-size: 12px !important;
      margin: 0 !important;
    }

    .mobileButton {
      display: flex;
    }

    .board {
      all: unset;
    }
    .boardContent{
      width: 100%;
      padding: 5px;
    }

    .mainPage {
      grid-template-columns: 1fr 1fr;
      padding: inherit;
      column-gap: 20px;
    }

    .ver-line, .line {
      display: none;
    }

    .filter {
      height: inherit;
      grid-column: 1 / -1;
      margin: -5px -10px;
      padding: 0 10px;
      border-bottom: 1.5px solid black;
    }
  }
  @media screen and (max-width: 1300px) {
    .board {
      grid-template-columns: 2fr 1fr;
    }
  }
</style>