<script>
  import * as d3 from "d3";
  import { fade } from 'svelte/transition';
  // Імпорт кастомних переходів вильоту/прильоту
  import { receive, send } from "$lib/transitions.js";
  // Імпорт даних та функцій зі сховища
  import { excludedQ, priorA, answerColors, horizontalQ } from "$lib/store.js";

  let { filteredData, FILTERS, isMobile } = $props();
  let groupedData = $derived.by(() => {
    return d3.group(filteredData, (d) => d.question);
  });

  // Створення ширини барів для кожного питання на основі % значення
  let xScales = $derived(new Map(
    Array.from(groupedData).map(([question, data]) => {
      // Знаходження максимальної частоти для питання
      const maxFreq = d3.max(data, d => d.freq) || 0;
      // Визначення ширини від 0 до 200px
      const scale = d3.scaleLinear()
        .domain([0, maxFreq])
        .range([0, 200]);
      return [question, scale];
    })
  ));

  // Кешування загальної кількості відповідей
  let totalCountCache = $state(new Map());

  // Оновлення даних при зміні фільтрів
  $effect(() => {
    // Очищення кешу
    totalCountCache.clear();

    // Групування питань
    const questionGroups = new Map();
    const bar = new Map();
    filteredData.forEach(q => {
      if (!questionGroups.has(q.question)) {
        questionGroups.set(q.question, []);
      }
      questionGroups.get(q.question).push(q);
    });

    // Обчислення загальної кількості для кожного питання
    questionGroups.forEach((items, question) => {
      const total = items.reduce((sum, q) => sum + q.freq, 0);
      totalCountCache.set(question, total);
    });

    // Обчислення відсотків для кожної відповіді
    filteredData.forEach(q => {
      const totalFreq = totalCountCache.get(q.question) || 0;

      // Якщо частота дорівнює 0, встановити відсоток як 0%
      if (q.freq === 0 || totalFreq === 0) {
        bar.set(q, { percentText: '0%', showOutsideText: true });
        return;
      }

      // Якщо кількість занадто мала, але не = 0, встановити відсоток як '<1%'
      const percent = Math.round((q.freq / totalFreq) * 100);
      const newPercentText = percent === 0 ? '<1%' : percent + '%';
      const barWidth = xScales.get(q.question)(q.freq);

      // Якщо бар менше 40px то показувати текст ззовні
      bar.set(q, { 
        percentText: newPercentText, 
        showOutsideText: barWidth < 40 || percent === 0 
      });
    });

    // Застосування оновлень до бару
    bar.forEach((update, q) => {
      Object.assign(q, update);
    });
  });

  // Функція обробки кліку по відповіді
  function handleAnswerClick(q, event) {
    event.stopPropagation();

    // Перемикання стану
    q.selected = !q.selected;

    // Додавання/видалення з фільтрів
    if (q.selected) {
      // Додавання питання до масиву фільтрів
      FILTERS[q.question] ??= [];
      // Додавання відповіді до фільтру
      if (!FILTERS[q.question].includes(q.answer)) {
        FILTERS[q.question].push(q.answer);
      }
    } else {
      // Видалення питання з фільтру
      if (FILTERS[q.question]) {
        FILTERS[q.question] = FILTERS[q.question].filter(item => item !== q.answer);
        // Видалення фільтру якщо він порожній
        if (FILTERS[q.question].length === 0) {
          delete FILTERS[q.question];
        }
      }
    }
  }

  // Перевірка чи є відповіді з ненульовою частотою
  function hasNonZeroAnswers(groupKey) {
    return filteredData
      .filter(q => q.question === groupKey)
      .some(q => q.freq > 0);
  }

  // Перевірка чи є питання горизонтальним
  function isHorizontalQuestion(question) {
    return horizontalQ.some(fragment => question.includes(fragment));
  }

  // Отримання кольору для відповіді
  function getBarColor(answer) {
    return answerColors.get(answer) || '#FF685D';
  }

  // Послідовність відповідей
  function sortAnswers(answers) {
    return answers.sort((a, b) => {
      // Спочатку сортуємо за пріоритетним списком [змінювати у store.js в priorA]
      const aIndex = priorA.indexOf(a.answer);
      const bIndex = priorA.indexOf(b.answer);
      const aInPrior = aIndex !== -1;
      const bInPrior = bIndex !== -1;

      // Якщо обидві відповіді в пріоритетному списку, сортувати за послідовністю
      if (aInPrior && bInPrior) {
        return aIndex - bIndex;
      }
      // Якщо тільки одна в пріоритетному списку, враховувати також частоту
      if (aInPrior && !bInPrior) {
        if (a.freq >= b.freq) {
          return -1;
        } else {
          return 1;
        }
      }
      if (!aInPrior && bInPrior) {
        if (b.freq >= a.freq) {
          return 1;
        } else {
          return -1;
        }
      }

      // Підтримка числових відповідей
      const aNum = parseFloat(a.answer);
      const bNum = parseFloat(b.answer);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }

      // Інакше сортувати за частотою (від більшого до меншого)
      return b.freq - a.freq;
    });
  }
</script>

<div class="questionContainer">
	{#each groupedData as [key]}
    <!-- Показати питання тільки якщо: воно не в списку excludedQ [store.js], має ненульові відповіді, та не має в активних фільтрах -->
    {#if !excludedQ.includes(key) && hasNonZeroAnswers(key) && !(FILTERS[key] && FILTERS[key].length > 0)}
      <!-- Контейнер для окремого питання з анімаціями входу/виходу -->
      <div class="conQ" class:horizontal-question={isHorizontalQuestion(key)}
        in:receive={{ key: key, noAnimation: isMobile }}
        out:send={{ key: key, noAnimation: isMobile }}>

        <!-- Заголовок питання -->
        <p class="question" 
          role="button"
          tabindex="0">
          {key}
        </p>

        <!-- Горизонтальне відображення [змінювати у store.js в horizontalQ] -->
        {#if isHorizontalQuestion(key)}
          <div class="horizontal-bars">
            {#each sortAnswers(filteredData.filter( d => d.question === key)) as q (q.id)}
              {#key q.id}

                <div class="horizontal-answer" 
                  class:selected={q.selected}
                  class:inactive={q.percentText === '0%'}
                  onclick={(event) => q.percentText !== '0%' && handleAnswerClick(q, event)}
                  role="button"
                  tabindex={q.percentText === '0%' ? -1 : 0}>

                  <!-- Відсоток -->
                  <p>{q.percentText}</p>

                  <!-- Бар -->
                  <div class="horizontal-bar" 
                       style="height: {xScales.get(q.question)(q.freq)}px; background-color: {getBarColor(q.answer)};">
                  </div>

                  <!-- Підпис відповіді -->
                  <p class="horizontal-label">{q.answer}</p>
                </div>
              {/key}
            {/each}
          </div>
        {:else}
          <!-- Вертикальне відображення (стандартне) -->
          {#each sortAnswers(filteredData.filter( d => d.question === key)) as q (q.id)}
            {#key q.id}

              <div class="answer"
                class:selected={q.selected}
                class:inactive={q.percentText === '0%'}
                onclick={(event) => q.percentText !== '0%' && handleAnswerClick(q, event)}
                role="button"
                tabindex={q.percentText === '0%' ? -1 : 0}>

                <!-- Підпис відповіді -->
                <p class="bar-label">{q.answer}</p>

                <div class="bar-wrapper">
                  <!-- Бар -->
                  <div class="bar" style="width: {xScales.get(q.question)(q.freq)}px; background-color: {getBarColor(q.answer)};">
                    <!-- Текст всередині бару (якщо бар достатньо широкий) -->
                    {#if !q.showOutsideText && q.percentText && xScales.get(q.question)(q.freq) >= 20}
                      <p transition:fade>{q.percentText}</p>
                    {/if}
                  </div>
                  <!-- Текст зовні бару (якщо бар занадто вузький) -->
                  {#if q.showOutsideText && q.percentText}
                    <p class="bar-text-outside" transition:fade>
                      {q.percentText}
                    </p>
                  {/if}
                </div>

              </div>
            {/key}
          {/each}
        {/if}
      </div>
    {/if}
  {/each}
</div>

<style>
  p {
    font-family: 'Cy Grotesk';
    margin: 0;
  }

  .questionContainer {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-column-gap: 20px;
    grid-row-gap: 30px;
    margin-top: 5px;
  }
  .question {
    align-content: flex-start;
    font-size: 15px;
    margin-bottom: 10px;
    line-height: 1;
  }

  .answer {
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .answer.inactive, .horizontal-answer.inactive {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .answer:hover {
    background-color: #f5f5f5;
  }
  .answer.selected {
    background-color: #fff0ef;
  }
  .answer.selected .bar-label {
    color: #FF685D;
  }
  .answer.selected .bar {
    background-color: #FF685D;
    box-shadow: 0 0 0 2px rgba(255, 104, 93, 0.3);
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    background-color: #FF685D;
    height: 20px;
    color: white;
    font-size: 12px;
    box-sizing: border-box;
    position: relative;
    padding-right: 3px;
    transition: width 1s ease;
  }

  .bar-label {
    font-size: 11px;
    font-weight: 300;
  }
  .bar-wrapper {
    display: flex;
    align-items: center;
    gap: 5px;
    width: 200px;
  }
  .bar-text-outside {
    font-size: 12px;
    color: #000;
    white-space: nowrap;
  }

  .horizontal-question {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .horizontal-bars {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    height: 100%;
  }
  .horizontal-answer p {
    font-size: 12px;
  }
  .horizontal-answer {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: all 0.2s ease;
    height: 100%;
    justify-content: flex-end;
  }
  .horizontal-answer:hover {
    background-color: #f5f5f5;
  }
  .horizontal-answer.selected {
    background-color: #fff0ef;
  }
  .horizontal-answer.selected .horizontal-label {
    color: #FF685D;
  }
  .horizontal-answer.selected .horizontal-bar {
    background-color: #FF685D;
    box-shadow: 0 0 0 2px rgba(255, 104, 93, 0.3);
  }
  .horizontal-bar {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    justify-content: center;
    background-color: #FF685D;
    width: 40px;
    color: white;
    font-size: 12px;
    box-sizing: border-box;
    position: relative;
    padding-bottom: 5px;
    margin-bottom: 5px;
  }
  .horizontal-bar {
    transition: height 1s ease;
  }
  .horizontal-label {
    font-size: 11px;
    text-align: center;
    transition: color 0.2s ease;
    max-width: 60px;
  }

  @media screen and (max-width: 800px) {
    p {
      font-size: 12px;
    }

    .questionContainer {
      grid-template-columns: 1fr;
      padding: 0px 5px;
      gap: 15px;
    }
    .conQ {
      padding-bottom: 5px;
      border-bottom: 1px solid grey;
    }

    .question {
      font-size: 12px;
    }
    .answer {
      margin-bottom: 5px;
    }
  }
</style>