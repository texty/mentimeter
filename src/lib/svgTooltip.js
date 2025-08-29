import { writable } from 'svelte/store';

export const showTooltip = writable(false);
export const tooltipRegion = writable([]);

// Показує тултип з відповідною інформацією при наведенні на елемент
export const handleMouseEnter = (event, options = {}) => {
  // Якщо елемент не має ID - не застосовуємо
  if (!event.target.id) return;

  const { regionName, tooltips, districtCounts, regionCounts, setTooltipRegion, setTooltipCount } = options;

  // Для районів у Filter.svelte
  if (regionName && tooltips && districtCounts) {
    tooltips[regionName] = {
      show: true,
      region: event.target.id,
      count: districtCounts[`${regionName}:${event.target.id}`] || 0,
      x: event.clientX + 10, // Позиції X, Y з невеликим зсувом для кращого
      y: event.clientY - 10  // відображення миші
    };
  }

  // Для областей у Map.svelte
  if (setTooltipRegion && setTooltipCount && regionCounts) {
    setTooltipRegion(event.target.id);
    setTooltipCount(regionCounts[event.target.id] || 0);
    showTooltip.set(true);
  }
};

// Оновлює позицію підказки відповідно до позиції курсора
export const handleMouseMove = (event, options = {}) => {
  const { regionName, tooltips, setTooltipX, setTooltipY } = options;

  // Для районів у Filter.svelte
  if (regionName && tooltips && tooltips[regionName]?.show) {
    tooltips[regionName].x = event.clientX + 10;
    tooltips[regionName].y = event.clientY - 10;
  }

  // Для областей у Map.svelte
  if (setTooltipX && setTooltipY) {
    showTooltip.subscribe(show => {
      if (show) {
        setTooltipX(event.clientX + 10);
        setTooltipY(event.clientY - 10);
      }
    })();
  }
};

// Приховує тултип при покиданні миші з елементу
export const handleMouseLeave = (regionName = null, tooltips = null) => {
  if (regionName && tooltips && tooltips[regionName]) {
    tooltips[regionName].show = false;
  } else {
    showTooltip.set(false);
  }
};

// Правильне відмінювання форми слова "анкета" в залежності від числа
export const getCountForm = (count) => {
  if (count === 1) return 'анкета';
  if (count >= 2 && count <= 4) return 'анкети';
  if (count >= 5 && count <= 20) return 'анкет';

  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'анкет';
  if (lastDigit === 1) return 'анкета';
  if (lastDigit >= 2 && lastDigit <= 4) return 'анкети';

  return 'анкет';
};