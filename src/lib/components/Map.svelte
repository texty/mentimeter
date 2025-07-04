<script>
  import { base } from "$app/paths";
  import { tick, onMount } from 'svelte';
  // Імпорт даних та функцій зі сховища
  import { selectedRegion, surveysRaw, calculateStats, interpolateColor, regionAnimationData } from "$lib/store.js";
  // Імпорт логіки відображення тултіпу при наведенні на мапу
  import { getCountForm, handleMouseLeave, handleMouseEnter, handleMouseMove, showTooltip } from "$lib/svgTooltip.js";

  let { FILTERS = $bindable({}) } = $props();

  // Дані SVG файлу
  let svgContainer = $state();
  let svgPaths = [];
  let stats = $state({ min: 0, max: 0, counts: {} });
  let svgContent = $state('');
  let svgLoaded = $state(false);

  // Налаштування для спливаючої підказки
  let tooltip = $state({ x: 0, y: 0, region: '', count: 0 });

  // Налаштування для роботи зі спливаючою підказкою
  const tooltipSettings = {
    setTooltipRegion: (v) => tooltip.region = v, // Назва області
    setTooltipCount: (v) => tooltip.count = v,   // Кількість анкет
    setTooltipX: (v) => tooltip.x = v,           // Координати X
    setTooltipY: (v) => tooltip.y = v            // Координати Y
  };

  // Завантажує SVG при запуску сторінки
  onMount(loadSvgContent);

  async function loadSvgContent() {
    // Шлях до SVG областей
    const response = await fetch(`${base}/img/regions.svg`);
    if (!response.ok) throw new Error('Failed to load SVG');

    svgContent = await response.text();
    svgLoaded = true;

    // Очікує оновлення DOM
    await tick();
    // Знаходить всі області (ID)
    svgPaths = [...(svgContainer?.querySelectorAll('path[id]') || [])];
    addEventListeners();
  }

  // Розраховує статистику з урахуванням фільтрів
  function calculateFilteredStats(data, filters) {
    const { regionStats } = calculateStats(data, filters);
    stats = regionStats;
  }

  async function updateRegionColors() {
    await tick();
    const paths = svgPaths;

    if (!paths.length) return;

    // Отримує список обраних областей
    const selectedRegions = Array.isArray($selectedRegion) ? $selectedRegion : [];

    // Встановлює колір для кожної області
    paths.forEach(path => {
      const count = stats.counts[path.id] || 0;
      // Розраховує інтенсивність кольору
      const intensity = stats.max > 0 ? count / stats.max : 0;

      // Застосовує стилі
      Object.assign(path.style, {
        fill: interpolateColor(intensity), // Колір заливки
        cursor: count > 0 ? 'pointer' : 'not-allowed', // Стиль курсору
        stroke: selectedRegions.includes(path.id) ? '#000000' : '', // Обведення якщо обрано
        strokeWidth: selectedRegions.includes(path.id) ? '1px' : '' // Товщина обведення
      });
    });
  }

  // Обробляє клік по області
  function handleRegionClick(event) {
    const regionName = event.target.id;
    if (!regionName) return;

    const count = stats.counts[regionName] || 0;
    // Не дозволяє вибирати область з нульовою кількістю анкет
    if (count === 0) return;

    const currentSelected = Array.isArray($selectedRegion) ? [...$selectedRegion] : [];
    const index = currentSelected.indexOf(regionName);
    const isSelecting = index === -1;

    if (isSelecting) {
      // Якщо клікнуто то додається до обраних областей
      currentSelected.push(regionName);

      // Визначає положення області на екрані для анімації польоту
      const rect = event.target.getBoundingClientRect();
      const svgRect = svgContainer.getBoundingClientRect();

      // Застосування анімації польоту при виборі області
      regionAnimationData.update(data => ({
        ...data,
        [regionName]: {
          left: rect.left - svgRect.left,
          top: rect.top - svgRect.top,
          width: rect.width,
          height: rect.height,
          viewportX: rect.left + window.scrollX,
          viewportY: rect.top + window.scrollY
        }
      }));
    } else {
      // Якщо клікнуто вдруге, то видаляє область з обраних
      currentSelected.splice(index, 1);
      regionAnimationData.update(data => {
        const newData = { ...data };
        delete newData[regionName];
        return newData;
      });
    }

    // Оновлює стан обраних областей
    selectedRegion.set(currentSelected);

    // Додає/видаляє обрану область з фільтрів
    FILTERS = currentSelected.length === 0 ? 
      (() => { const { Область, ...rest } = FILTERS; return rest; })() :
      { ...FILTERS, Область: currentSelected };
  }

  // Додає обробники подій для всіх областей
  async function addEventListeners() {
    await tick();

    svgPaths.forEach(path => {
      if (path?.id) {
        const handlers = {
          click: handleRegionClick, // Клік по області
          mouseenter: (e) => handleMouseEnter(e, { regionCounts: stats.counts, ...tooltipSettings }), // Наведення миші
          mouseleave: handleMouseLeave, // Відведення миші
          mousemove: (e) => handleMouseMove(e, { svgContainer, ...tooltipSettings }) // Рух миші
        };

        // Для кожної області створюється окремий обробник подій
        // для правильного відображення даних у тултипі
        Object.entries(handlers).forEach(([event, handler]) => {
          path.removeEventListener(event, handler);
          path.addEventListener(event, handler);
        });
      }
    });
  }

  // Оновлює мапу при зміні фільтрів
  $effect(() => {
    if (!svgLoaded || !svgContainer) return;

    calculateFilteredStats($surveysRaw, FILTERS);
    updateRegionColors();
  });
</script>

<div class="map-container">
  <!-- Контейнер для SVG мапи -->
  <div bind:this={svgContainer} class="svg-container">
    {@html svgContent}

    <!-- Спливаюча підказка (тултіп) -->
    {#if $showTooltip}
      <div class="tooltip" style="left: {tooltip.x}px; top: {tooltip.y}px;">
        <p class="tooltip-region">{tooltip.region}</p>
        <p class="tooltip-count">{tooltip.count} {getCountForm(tooltip.count)}</p>
      </div>
    {/if}
  </div>

  <!-- Легенда з градієнтом -->
  <div>
    <p>Кількість учасників</p>
    <div class="gradient"></div>
    <div class="countText">
      <p>{stats.min}</p>
      <p>{stats.max}</p>
    </div>
  </div>
</div>

<style>
  p {
    font-family: 'Cy Grotesk';
    font-size: 12px;
    margin: 0;
  }

  .map-container {
    display: flex;
    position: relative;
    flex-direction: column;
    height: 100%;
  }

  .svg-container {
    display: flex;
    justify-content: center;
    position: relative;
    height: 100%;
  }

  .gradient {
    width: 100%;
    height: 6px;
    background: linear-gradient(270.00deg, rgb(255, 104, 93), rgb(255, 224, 222) 100%);
    margin: 3px 0 3px 0;
  }

  .countText {
    display: flex;
    justify-content: space-between;
  }

  .tooltip {
    position: fixed;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 6px 10px;
    border-radius: 4px;
    pointer-events: none;
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

  :global(svg) {
    margin: 0;
    width: 100%;
    height: 100%;
  }
  :global(path[id]:hover) {
    opacity: 0.8 !important;
  }

  @media screen and (max-width: 800px) {
    p {
      font-size: 10px;
    }

    .svg-container {
      max-height: 200px;
    }
  }
</style>