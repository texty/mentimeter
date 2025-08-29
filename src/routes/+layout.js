export const prerender = true; // Попередня генерація сторінки
export const ssr = true; // Серверний рендеринг
export const trailingSlash = 'always'; // Завжди додавати слеш в кінці URL

import { csvParse } from 'd3'
import { base } from '$app/paths';

// Імпорт даних та функцій зі сховища
import { surveysRaw, answerStats, calculateStats } from '$lib/store.js';

// Функція завантаження даних
export async function load({ fetch }) {
  // Шлях до CSV файлу з анкетами
  const dataUrl = base + '/data/surveys.csv';
  const [csvRes] = await Promise.all([
    fetch(dataUrl),
  ]);

  // Отримуємо текст CSV файлу
  const csvWide = await csvRes.text();

  // Парсимо CSV у масив об'єктів (кожен рядок = одна анкета)
  const rawData = csvParse(csvWide);

  // Зберігаємо сирі дані анкет у сховище
  surveysRaw.set(rawData);

  // Отримуємо назви колонок (питання) з першого рядка
  const questionCols = rawData.length > 0 ? Object.keys(rawData[0]) : [];

  // Рахуємо частоту для кожної пари "питання-відповідь"
  const { freqMap } = calculateStats(rawData, {}, questionCols);

  // Даємо кожному питанню власний ID
  let idCounter = 1;
  const filtered = [];

  // Формуємо масив питань
  freqMap.forEach((freq, key) => {
    const [question, answer] = key.split("||"); // Розділяємо ключ на питання та відповідь
    filtered.push({
      id: idCounter++, // Унікальний ID
      question,        // Текст питання
      answer,          // Варіант відповіді
      freq,            // Частота цієї відповіді
      selected: false, // Чи обрана відповідь (для застосування фільтрації)
    });
  });

  // Зберігаємо цей масив у сховище
  answerStats.set(filtered);
}