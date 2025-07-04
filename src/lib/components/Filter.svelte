<script>
  import { base } from "$app/paths";
  import { tick, onMount } from 'svelte';
  import * as d3 from "d3";
  // Імпорт анімацій
  import { send, receive, flyFromMap } from "$lib/transitions.js";
  // Імпорт даних та функцій зі сховища
  import { selectedRegion, selectedDistrict, calculateStats, interpolateColor, regionAnimationData, surveysRaw, priorA, excludedQ, regionToSvgMap } from "$lib/store.js";
  // Імпорт логіки відображення тултіпу при наведенні на мапу
  import { getCountForm, handleMouseLeave, handleMouseEnter, handleMouseMove } from "$lib/svgTooltip.js";

  let { filteredData, FILTERS = $bindable({}), isMobile } = $props();
  let groupedData = d3.group(filteredData, (d) => d.question);

  let expandedQs = $state({});
  let selectedRegions = $state({});
  let selectedSchools = $state({});
  let regionSvgContents = $state({});
  let svgContainers = $state({});
  let tooltips = $state({});

  // Код поділений на три окремі частини:
  // 1. РОБОТА З МАПОЮ

  onMount(() => {
    preloadAllRegionSvgs(); // Попереднє завантаження всіх SVG мап
  });

  // Завантаження всіх SVG областей
  async function preloadAllRegionSvgs() {
    const loadPromises = Object.entries(regionToSvgMap).map(async ([regionName, svgFileName]) => {
      try {
        // Шлях до всіх областей
        const response = await fetch(`${base}/img/districts/${svgFileName}.svg`);
        if (!response.ok) throw new Error('Failed to load SVG');

        const content = await response.text();
        regionSvgContents[regionName] = content;
      } catch (error) {
        console.error(`Error preloading SVG for ${regionName}:`, error);
      }
    });

    await Promise.all(loadPromises);
  }

  // Завантаження SVG для конкретного регіону
  async function loadRegionSvg(regionName) {
    if (regionSvgContents[regionName]) {
      await tick();
      initializeDistrictSvg(regionName); // Ініціалізація SVG районів
    }
  }

  // Завантаження SVG вибраних регіонів
  $effect(() => {
    if (Array.isArray($selectedRegion)) {
      $selectedRegion.forEach(region => {
        selectedRegions[region] ??= true;
        loadRegionSvg(region);
      });
    }
  });

  // Обробка кліків по районах на карті
  function handleDistrictClick(event, regionName) {
    event.preventDefault();
    event.stopPropagation();

    const pathId = event.target.id;
    if (!pathId) return;

    const districtKey = `${regionName}:${pathId}`;
    const count = districtCounts[districtKey] || 0;
    if (count === 0) return; // Якщо район не має даних, не дозволяємо вибір

    const currentDistricts = [...($selectedDistrict || [])];
    const isSelected = currentDistricts.includes(districtKey);

    // Додаємо/видаляємо район з вибраних
    const newDistricts = isSelected 
      ? currentDistricts.filter(d => d !== districtKey)
      : [...currentDistricts, districtKey];

    selectedDistrict.set(newDistricts);

    // Оновлюємо фільтри
    if (newDistricts.length > 0) {
      FILTERS['Район'] = newDistricts.map(d => d.split(':')[1]);
    } else {
      delete FILTERS['Район'];
    }
  }

  // Підрахунок кількості анкет по районах
  let districtCounts = $state({});
  let regionMaxCounts = $state({});

  // Розрахунок статистики по всіх районах
  function calculateAllDistrictStats(regions, data, filters) {
    const { filteredData } = calculateStats(data, filters);

    const newDistrictCounts = {};
    const newRegionMaxCounts = {};

    // Визначаємо максимальні значення по областях
    regions.forEach(region => {
      newRegionMaxCounts[region] = 0;
    });

    // Підраховуємо кількість записів по районах
    filteredData.forEach(item => {
      const region = item['Область'];
      const district = item['Район'];

      if (regions.includes(region) && district && district !== 'NA') {
        const key = `${region}:${district}`;
        newDistrictCounts[key] = (newDistrictCounts[key] || 0) + 1;

        newRegionMaxCounts[region] = Math.max(newRegionMaxCounts[region], newDistrictCounts[key]);
      }
    });

    return { districtCounts: newDistrictCounts, regionMaxCounts: newRegionMaxCounts };
  }

  // Оновлення кольорів районів на мапі
  function updateDistrictColors(regionName) {
    const container = svgContainers[regionName];
    if (!container) return;

    // Витягуємо дані для поточного району
    const paths = container.querySelectorAll('path[id]');
    const currentDistricts = $selectedDistrict || [];
    const regionMaxCount = regionMaxCounts[regionName] || 0;

    paths.forEach(path => {
      if (!path.id) return;

      // Беремо назви районів з кожної області
      const districtKey = `${regionName}:${path.id}`;
      const count = districtCounts[districtKey] || 0;

      // Розраховуємо інтенсивність кольору
      const intensity = regionMaxCount > 0 ? count / regionMaxCount : 0;
      const isSelected = currentDistricts.includes(districtKey);
      const baseColor = interpolateColor(intensity);

      // Застосовуємо обведення якщо обрано район
      if (isSelected) {
        Object.assign(path.style, {
          fill: baseColor,
          stroke: '#000000',
          strokeWidth: '1px'
        });
      } else {
        Object.assign(path.style, {
          fill: baseColor,
          stroke: '',
          strokeWidth: ''
        });
      }

      // Стиль курсору при наведенні
      Object.assign(path.style, {
        cursor: count > 0 ? 'pointer' : 'not-allowed'
      });
    });
  }

  // Ініціалізація SVG карти району
  function initializeDistrictSvg(regionName) {
    const container = svgContainers[regionName];
    if (!container) return;

    // Витягуємо дані для поточного району
    const paths = container.querySelectorAll('path[id]');
    if (paths.length === 0) return;

    paths.forEach(path => {
      if (!path.id || path._initialized) return;

      // Подальший код створює окремі обробники подій для кожного району
      // (поведінка при наведенні, кліку, тощо)
      ['click', 'mouseenter', 'mouseleave', 'mousemove'].forEach(eventType => {
        const existingHandler = path[`_${eventType}Handler`];
        if (existingHandler) {
          path.removeEventListener(eventType, existingHandler);
        }
      });

      const clickHandler = (e) => handleDistrictClick(e, regionName);
      const mouseenterHandler = (e) => handleMouseEnter(e, {regionName, tooltips, districtCounts});
      const mouseleaveHandler = (e) => handleMouseLeave(regionName, tooltips);
      const mousemoveHandler = (e) => handleMouseMove(e, {regionName, tooltips, svgContainers});

      path.addEventListener('click', clickHandler);
      path.addEventListener('mouseenter', mouseenterHandler);
      path.addEventListener('mouseleave', mouseleaveHandler);
      path.addEventListener('mousemove', mousemoveHandler);

      path._clickHandler = clickHandler;
      path._mouseenterHandler = mouseenterHandler;
      path._mouseleaveHandler = mouseleaveHandler;
      path._mousemoveHandler = mousemoveHandler;

      path._initialized = true;
    });
    updateDistrictColors(regionName);
  }

  // Видалення регіону з фільтрів
  function removeRegion(regionName) {
    const currentSelected = [...($selectedRegion || [])].filter(region => region !== regionName);
    const currentDistricts = [...($selectedDistrict || [])].filter(d => !d.startsWith(`${regionName}:`));

    selectedRegion.set(currentSelected);
    selectedDistrict.set(currentDistricts);

    // Видаляємо дані анімації
    regionAnimationData.update(data => {
      const newData = { ...data };
      delete newData[regionName];
      return newData;
    });

    // Оновлюємо фільтри
    if (currentDistricts.length > 0) {
        FILTERS['Район'] = currentDistricts.map(d => d.split(':')[1]);
    } else {
        delete FILTERS['Район'];
    }

    // Видаляємо SVG з фільтру
    delete selectedRegions[regionName];
    delete svgContainers[regionName];
    delete tooltips[regionName];

    if (FILTERS['Область']) {
        FILTERS['Область'] = FILTERS['Область'].filter(region => region !== regionName);
        if (FILTERS['Область'].length === 0) delete FILTERS['Область'];
    }
  }

  // Видалення обраного району з фільтрів
  function removeDistrict(districtKey) {
    const currentDistricts = [...($selectedDistrict || [])];
    const newDistricts = currentDistricts.filter(d => d !== districtKey);
    selectedDistrict.set(newDistricts);

    if (newDistricts.length > 0) {
        FILTERS['Район'] = newDistricts.map(d => d.split(':')[1]);
    } else {
        delete FILTERS['Район'];
    }
  }

  // Повторні підрахунки даних анкет районів
  $effect(() => {
    const selectedDistricts = $selectedDistrict;
    if (selectedDistricts && Object.keys(svgContainers).length > 0) {
      const regions = Object.keys(svgContainers);

      const { districtCounts: newDistrictCounts, regionMaxCounts: newRegionMaxCounts } = 
        calculateAllDistrictStats(regions, $surveysRaw, FILTERS);

      districtCounts = newDistrictCounts;
      regionMaxCounts = newRegionMaxCounts;
    }
  });

  // Повторне оновлення кольорів районів
  $effect(() => {
    const selectedDistricts = $selectedDistrict;
    if (selectedDistricts && Object.keys(svgContainers).length > 0) {
      Object.keys(svgContainers).forEach(regionName => {
        updateDistrictColors(regionName);
      });
    }
  });


  // 2. РОБОТА З ПИТАННЯМИ

  // Кожне питання має бути розгорнутим за замовчуванням
  $effect(() => {
    groupedData.forEach((_, question) => {
      expandedQs[question] ??= true;
    });
  });

  // Перевірка наявності активних фільтрів
  function hasActiveFilters() {
    return Object.keys(FILTERS).length > 0;
  }

  // Очищення всіх фільтрів
  function clearAllFilters() {
    Object.keys(FILTERS).forEach(key => delete FILTERS[key]);

    selectedRegion.set([]);
    selectedDistrict.set([]);

    filteredData.forEach(q => q.selected = false);

    Object.keys(expandedQs).forEach(question => {
      if (!FILTERS[question]) {
        delete expandedQs[question];
      }
    });
  }

  // Перемикання видимості відповідей для питання
  function toggleQuestion(question) {
    expandedQs[question] = !expandedQs[question];
  }

  // Застосування фільтру на основі обраної відповіді
  function handleAnswerToggle(q) {
    q.selected = !q.selected;
    const { question, answer, selected } = q;

    if (!selected) {
      // Якщо вже обрано, то видаляємо відповідь з фільтрів
      if (FILTERS[question]) {
        FILTERS[question] = FILTERS[question].filter(item => item !== answer);
        if (FILTERS[question].length === 0) delete FILTERS[question];
      }
    } else {
      // Додаємо відповідь до фільтрів
      FILTERS[question] ??= [];
      if (!FILTERS[question].includes(answer)) {
        FILTERS[question].push(answer);
      }
    }
  }

  // Видалення питання з блоку фільтрів
  function removeQuestion(question) {
    delete FILTERS[question];
    delete expandedQs[question];
    filteredData
      .filter(t => t.question === question)
      .forEach(q => q.selected = false);
  }

  // Функція сортування відповідей
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


  // 3. ПОШУК ШКІЛ

  // Отримання списку шкіл для конкретного району
  function getSchoolsForDistrict(regionName, districtName) {
    if (!$surveysRaw) return [];

    return [...new Set(
      $surveysRaw
        .filter(d => d['Область'] === regionName && d['Район'] === districtName)
        .map(d => d['Школа'])
        .filter(school => school && school !== 'NA')
    )];
  }

  // Застосування фільтру на основі обраної школи
  function handleSchoolToggle(school) {
    if (school === '') {
      delete FILTERS['Школа'];
    } else {
      FILTERS['Школа'] = FILTERS['Школа'] || [];
      const index = FILTERS['Школа'].indexOf(school);

      if (index > -1) {
        FILTERS['Школа'].splice(index, 1);
      } else {
        FILTERS['Школа'].push(school);
      }

      if (FILTERS['Школа'].length === 0) {
        delete FILTERS['Школа'];
      }
    }
  }

  // Перемикання видимості списку шкіл
  function toggleSchools(districtKey) {
    selectedSchools[districtKey] = !selectedSchools[districtKey];
  }
</script>

<div class="filters-header">
  <h2>Обрані фільтри</h2>
  {#if hasActiveFilters()}
  <button class="clear-all-button" onclick={clearAllFilters} title="Скинути фільтри">
    Скинути фільтри
  </button>
  {/if}
</div>

<!-- Відображення вибраних областей -->
{#each ($selectedRegion && Array.isArray($selectedRegion) ? $selectedRegion : []) as region (region)}
  {@const hasDistricts = $selectedDistrict.some(d => d.startsWith(region + ":"))}  
  <div class="region-section region-mobile"
    style="grid-template-columns: { hasDistricts  ? '1fr 1fr' : '16px 1fr 1fr' };
          align-items: { hasDistricts  ? 'flex-start' : 'center' };"
    in:flyFromMap={!isMobile ? {region, animationData: $regionAnimationData} : undefined}>

    <!-- Кнопка видалення області -->
    {#if !hasDistricts}
      <button class="remove-button" onclick={() => removeRegion(region)} title="Видалити область">
        ✕
      </button>
    {/if}

    <div>
      <!-- Назва області -->
      {#if !hasDistricts}
        <p class="region-name">{region}</p>
      {/if}

      <!-- Список вибраних районів -->
      {#if hasDistricts}
        <div class="selected-districts">
          {#each $selectedDistrict.filter(d => d.startsWith(region + ":")) as districtKey}
            {@const districtName = districtKey.split(':')[1]}
            <div style="display: flex; gap: 5px;">
              <button class="remove-button" onclick={() => removeDistrict(districtKey)} title="Видалити район">
                ✕
              </button>
              <div class="district">
                <p>{districtName} район</p>

                <!-- Список шкіл -->
                <div class="school-selector-container">
                  <div class="toggle-section">
                    <button class="toggle-button" onclick={() => toggleSchools(districtKey)} title="Школи">
                      <p>{selectedSchools[districtKey] ? "Згорнути" : "Обрати"} школи</p>
                      <span class="toggle-icon" class:expanded={selectedSchools[districtKey]}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="7" fill="none"><path stroke="#fff" stroke-linecap="round" stroke-width="2" d="M1.5 6 7 1.5M12.5 6 7 1.5"/></svg>
                      </span>
                    </button>
                  </div>

                  {#if selectedSchools[districtKey]}
                    <ul class="school-selector">
                      <li
                        class:selected={!FILTERS['Школа'] || FILTERS['Школа'].length === 0}
                        onclick={() => handleSchoolToggle('')}>
                        Усі школи
                      </li>
                      {#each getSchoolsForDistrict(region, districtName) as school}
                        <li
                          class:selected={FILTERS['Школа']?.includes(school)}
                          onclick={() => handleSchoolToggle(school)}>
                          {school}
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </div>

              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- SVG мапа області -->
    <div class="svg-container" bind:this={svgContainers[region]}>
      {#if regionSvgContents[region]}
        {@html regionSvgContents[region]}
        <!-- Підказка на карті (тултіп) -->
        {#if tooltips[region]?.show}
          <div class="tooltip" style="left: {tooltips[region].x}px; top: {tooltips[region].y}px;">
            <p class="tooltip-region">{tooltips[region].region}</p>
            <p class="tooltip-count">{tooltips[region].count} {getCountForm(tooltips[region].count)}</p>
          </div>
        {/if}
      {:else}
        <div class="loading">Завантаження...</div>
      {/if}
    </div>

  </div>
{/each}

<!-- Відображення вибраних питань та відповідей -->
{#each [...groupedData.entries()] as [question, answers]}
  {#if !excludedQ.includes(question) && FILTERS[question] && FILTERS[question].length > 0}
    <div class="question-section"
      in:receive={{ key: question, noAnimation: isMobile }}
      out:send={{ key: question, noAnimation: isMobile }}>

      <!-- Заголовок питання -->
      <div class="question-header">
        <button class="remove-button" onclick={() => removeQuestion(question)} title="Видалити питання">
          ✕
        </button>
        <p class="question-name">{question}</p>
      </div>

      <!-- Кнопка розгортання/згортання відповідей -->
      <div class="toggle-section">
        <button class="toggle-button" onclick={() => toggleQuestion(question)} title="Відповіді">
          <p>{expandedQs[question] ? "Згорнути" : "Показати"} відповіді</p>
          <span class="toggle-icon" class:expanded={expandedQs[question]}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="7" fill="none"><path stroke="#fff" stroke-linecap="round" stroke-width="2" d="M1.5 6 7 1.5M12.5 6 7 1.5"/></svg>
          </span>
        </button>
      </div>

      <!-- Список відповідей -->
      {#if expandedQs[question]}
        <div class="answers-container">
          {#each sortAnswers(answers) as q (q.id)}
            <div class="answer-item">
              <label class="checkbox-label">
                <input type="checkbox" checked={q.selected} onchange={() => handleAnswerToggle(q)}/>

                <p class="answer" class:selected={q.selected}>
                  {q.answer}
                </p>
              </label>
            </div>
          {/each}
        </div>
      {/if}

    </div>
  {/if}
{/each}

<style>
  h2 {
    font-size: 18px;
    font-weight: 500;
    text-transform: uppercase;
    margin: 10px 0 10px 0;
  }
  p {
    margin: 0;
  }
  p, h2, li {
    font-family: 'Cy Grotesk';
  }
  li {
    font-size: 10px;
  }

  .svg-container {
    position: relative;
    width: 150px;
    height: 150px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .svg-container :global(svg) {
    width: 100%;
    height: 100%;
  }

  .loading {
    font-size: 12px;
    color: #666;
  }

  .filters-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .clear-all-button {
    background-color: #000;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 16px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  .clear-all-button:hover {
    background-color: #FF685D;
  }

  .question-section {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 10px;
    border-bottom: 1px solid grey;
    padding-bottom: 5px;
  }

  .region-section {
    display: grid;
    gap: 5px;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid grey;
  }
  .region-name {
    background-color: #FF685D90;
    padding: 5px;
    font-size: 12px;
    text-align: center;
  }

  .school-selector-container {
    max-height: 200px;
    overflow-y: auto;
  }
  .school-selector {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid #ccc;
    border-top: 0px;
  }
  .school-selector li {
    padding: 6px;
    cursor: pointer;
    border-bottom: 1px solid #eee;
    transition: background-color 0.2s;
  }
  .school-selector li:last-child {
    border-bottom: none;
  }
  .school-selector li:hover {
    background-color: #f2f2f2;
  }
  .school-selector li.selected {
    background-color: #FFBEB9;
  }

  .question-header {
    display: flex;
    gap: 5px;
    align-items: flex-start;
  }
  .question-name {
    font-size: 12px;
    color: #333;
  }

  .selected-districts {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .district {
    overflow: hidden;
    width: 100%;
  }
  .district p {
    background-color: #FF685D90;
    padding: 5px;
    font-size: 12px;
    text-align: center;
  }

  .tooltip {
    position: fixed;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 6px 10px;
    border-radius: 4px;
    z-index: 1000;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(8px);
  }
  .tooltip-region {
    font-size: 12px;
    font-weight: bold;
    margin-bottom: 2px;
  }
  .tooltip-count {
    font-size: 11px;
  }

  .remove-button {
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
  .remove-button:hover {
    background-color: #e55a52;
  }

  .toggle-section {
    background-color: #FF685D;
  }
  .toggle-section p {
    padding: 0px;
  }
  .toggle-button {
    display: flex;
    align-items: center;
    padding: 7px;
    justify-content: space-between;
    width: 100%;
    cursor: pointer;
  }
  .toggle-button p {
    font-size: 10px;
    color: #fff;
  }
  .toggle-icon {
    font-size: 10px;
    transition: transform 0.2s ease;
    transform: rotate(-180deg);
  }
  .toggle-icon.expanded {
    transform: rotate(0deg);
  }

  .answers-container {
    animation: slideDown 0.5s ease;
  }
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .checkbox-label {
    display: flex;
    align-items: flex-start;
    cursor: pointer;
    gap: 5px;
    padding: 5px;
    border-radius: 3px;
    line-height: 1.3;
  }

  .answer {
    font-size: 11px;
    flex: 1;
    transition: all 0.2s ease;
  }
  .answer.selected {
    color: #FF685D;
  }

  input[type="checkbox"] {
    width: 14px;
    height: 14px;
    accent-color: #FF685D;
    margin: 0;
  }

  @media screen and (max-width: 800px) {
    h2 {
      display: none;
    }

    .clear-all-button {
      margin: 5px 0px;
    }
  }
</style>