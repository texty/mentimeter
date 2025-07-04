<script>
  import * as d3 from "d3";
  // Імпорт даних опитування з сховища
  import { surveysRaw } from "$lib/store.js";

  let { FILTERS = $bindable({}) } = $props();

  // Обробка даних для діаграми
  let chartData = $derived.by(() => {
    const chartItems = [];
    let idCounter = 1;

    // Обробка тільки двох питань: "Вік" та "Стать"
    ['Вік', 'Стать'].forEach(question => {
      const otherFilters = Object.fromEntries(
        Object.entries(FILTERS).filter(([key]) => key !== question)
      );

      // Фільтрація даних згідно з іншими фільтрами (не включаючи поточне питання)
      // Тобто "Вік" та "Стать" не впливають на власні результати
      const filtered = $surveysRaw.filter(d =>
        Object.entries(otherFilters).every(([key, values]) => {
          // Фільтр по діапазону дат
          if (key === 'dateRange') {
            const dateStr = d["Дата заповнення анкети"];
            if (!dateStr || dateStr === "NA") return false;
            const recordDate = new Date(dateStr);
            return recordDate >= new Date(values.start) && recordDate <= new Date(values.end);
          }
          return Array.isArray(values) ? values.length === 0 || values.includes(d[key]) : d[key] === values;
        })
      );

      // Відображаємо тільки ті відповіді, які не є "NA"
      const allPossibleAnswers = new Set();
      $surveysRaw.forEach(row => {
        const value = row[question];
        if (value && value !== "NA") {
          allPossibleAnswers.add(value);
        }
      });

      // Відображаємо кожну унікальну відповідь
      const sortedAnswers = Array.from(allPossibleAnswers);

      sortedAnswers.forEach(answer => {
        // Підрахунок частоти появи відповіді у відфільтрованих даних
        const freq = filtered.filter(row => row[question] === answer).length;
        chartItems.push({
          id: idCounter++, // ID
          question,        // Питання
          answer,          // Відповідь
          freq,            // Частота
          selected: FILTERS[question]?.includes(answer) || false  // Чи вибрана відповідь
        });
      });
    });
    return chartItems;
  });

  let groupedData = $derived(d3.group(chartData, d => d.question));

  // Створення вертикальних барів
  let yScales = $derived(new Map(
    Array.from(groupedData).map(([question, data]) => {
      // Знаходження максимальної частоти для питання
      const maxFreq = d3.max(data, d => d.freq) || 0;
      // Створення бару висотою від 0 до 150px
      const scale = d3.scaleLinear()
        .domain([0, maxFreq])
        .range([0, 150]);
      return [question, scale];
    })
  ));

  // Обробка кліку по відповіді
  function handleAnswerClick(q, event) {
    event.stopPropagation();

    if (!FILTERS[q.question]) {
      FILTERS[q.question] = [];
    }

    if (q.selected) {
      // Щоб видалити відповідь з фільтру треба ще раз клікнути на неї
      FILTERS[q.question] = FILTERS[q.question].filter(item => item !== q.answer);
      if (FILTERS[q.question].length === 0) {
        delete FILTERS[q.question];
      }
    } else {
      // Додаємо питання до фільтру
      FILTERS[q.question].push(q.answer);
    }
  }

  // Скидання всіх фільтрів
  function resetQuestionFilters(question) {
    delete FILTERS[question];
  }
</script>

<div class="questionContainer">
  {#each groupedData as [key, value], i}
    <div class="question-section" class:question-section-mobile={i === 1}>

      <div class="question-header">
        <!-- Питання -->
        <p class="question" class:question-mobile={i === 0}>{key}</p>
        <!-- Кнопка скидання відповідного фільтру -->
        {#if FILTERS[key]?.length > 0}
          <button class="reset-button" onclick={() => resetQuestionFilters(key)} title="Скинути фільтри для {key}">
            ✕
          </button>
        {/if}
      </div>

      <!-- Діаграма -->
      <div class="chart-container">
        {#each value as q (q.id)}
          <div class="answer"
            class:answer-mobile={i === 1}
            class:selected={q.selected}
            class:dimmed={!q.selected && FILTERS[q.question]?.length > 0}
            onclick={(event) => q.freq !== 0 && handleAnswerClick(q, event)}
            class:inactive={q.freq === 0}
            role="button"
            tabindex={q.freq === 0 ? -1 : 0}>

            <!-- Бар -->
            <div class="bar-wrapper"
              class:bar-wrapper-mobile={i === 1}>

              <!-- [декстоп] Текст з частотою -->
              <p class="bar-text-outside desktop"
                class:selected={q.selected}
                class:dimmed={!q.selected && FILTERS[q.question]?.length > 0}>
                {q.freq}
              </p>

              <!-- [мобілка] Підпис відповіді -->
              <p class="bar-label mobile"
                class:bar-label-first={i === 0}
                class:selected={q.selected}
                class:dimmed={!q.selected && FILTERS[q.question]?.length > 0}>
                {q.answer}
              </p>

              <!-- Сам бар діаграми -->
              <div class="bar" 
                style="height: {yScales.get(q.question)(q.freq)}px; --bar-width: {yScales.get(q.question)(q.freq) * 100 / 150}"></div>
            </div>

            <!-- [мобілка] Текст з частотою -->
            <p class="bar-text-outside mobile"
              class:selected={q.selected}
              class:dimmed={!q.selected && FILTERS[q.question]?.length > 0}>
              {q.freq}
            </p>

            <!-- [декстоп] Підпис відповіді -->
            <p class="bar-label desktop"
              class:selected={q.selected}
              class:dimmed={!q.selected && FILTERS[q.question]?.length > 0}>
              {q.answer}
            </p>

          </div>
        {/each}
      </div>

    </div>

    {#if i === 0}
      <div class="ver-line"></div>
    {/if}
  {/each}
</div>

<style>
  p {
    font-family: 'Cy Grotesk';
    margin: 0;
  }

  .mobile {
    display: none;
  }

  .questionContainer {
    display: flex;
    align-items: flex-end;
    height: 100%;
    gap: 10px;
  }
  .question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .question {
    align-content: flex-start;
    font-size: 15px;
  }

  .ver-line {
    border-left: 1.5px solid black; 
    height: 100%;
    align-self: center;
  }

  .reset-button {
    background-color: black;
    font-size: 10px;
    font-weight: 800;
    cursor: pointer;
    border-radius: 90px;
    color: white;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .reset-button:hover {
    background-color: #e55a52;
  }

  .chart-container {
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }

  .answer {
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .answer.inactive {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .answer:hover {
    background-color: #f5f5f5;
  }
  .answer.selected .bar {
    background-color: #FF685D;
  }
  .answer.dimmed .bar {
    background-color: #FF685D31;
    border: 1px solid #FF685D;
  }

  .bar {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    width: clamp(25px, 3vw, 35px);
    color: black;
    font-size: 12px;
    box-sizing: border-box;
    position: relative;
    background-color: #FF685D;
    border: 1px solid transparent;
    transition: height 1s ease, background-color 0.3s ease, border 0.3s ease, width 1s ease;
  }
  .bar-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 170px;
  }
  .bar-label {
    margin-top: 3px;
    font-size: 10px;
    text-align: center;
    color: #000;
  }
  .bar-label-first {
    width: 10px;
  }
  .bar-label.selected {
    color: #000;
  }
  .bar-label.dimmed {
    color: #00000044;
  }
  .bar-text-outside {
    font-size: 10px;
    color: #FF685D;
    white-space: nowrap;
  }
  .bar-text-outside.selected {
    color: #FF685D;
  }
  .bar-text-outside.dimmed {
    color: #FF685D31;
  }

  @media screen and (max-width: 800px) {
    .desktop {
      display: none;
    }
    .mobile {
      display: flex;
    }

    .ver-line {
      display: none;
    }

    .question {
      font-size: 12px;
    }
    .question-mobile {
      margin-left: 15px;
    }
    .questionContainer {
      flex-direction: column;
      gap: 5px;
    }
    .question-section {
      width: 100%;
    }
    .question-section-mobile {
      padding-left: 15px;
    }

    .chart-container {
      flex-direction: column;
      align-items: stretch;
      gap: 0px;
    }

    .answer {
      flex-direction: row;
      transition: none;
      gap: 5px;
    }
    .answer-mobile {
      align-items: flex-end !important;
    }

    .bar-label {
      text-align: start;
      margin-top: inherit;
    }
    .bar {
      width: calc(var(--bar-width) * 1px);
      height: 12px !important;
      min-width: 5px;
      align-items: center;
      justify-content: flex-start;
      transition: none;
    }
    .bar-wrapper {
      flex-direction: row;
      height: auto;
      justify-content: flex-start;
      align-items: center;
      gap: 5px;
    }
    .bar-wrapper-mobile {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 0px !important;
    }
    .bar-text-outside {
      min-width: 25px;
      flex-shrink: 0;
    }
  }
</style>