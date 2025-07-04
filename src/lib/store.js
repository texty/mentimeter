
// Питання, які НЕ мають відображатись у блоці фільтрів [школа, район та область мають свою окрему логіку]
export const excludedQ = ['Вік', 'Стать', 'Дата заповнення анкети', 'Школа', 'Район', 'Область'];

// Пріоритетні питання. Розташування визначає порядок відображення на сторінці
export const priorityQuestions = ['п1', 'п2'];

// Питання, які мають відображатись горизонтально
export const horizontalQ = [
  'Чи вважаєш ти себе щасливою людиною',
  'Якщо щось пішло не так – у першу чергу треба знайти винних і покарати чи знайти збої в системі і причини помилки?',
];

// Послідовність відповідей. Для всіх інших сортування відбувається за кількістю
export const priorA = [
  'Так, повністю погоджуюсь',
  'Так, скоріше погоджуюсь',
  'Важко відповісти',
  'Ні, скоріше не погоджуюсь',
  'Ні, повністю не погоджуюсь',
];

// Зафарбовуємо питання у відповідні кольори
export const answerColors = new Map([
  ['Так, повністю погоджуюсь', '#FF685D'],
  ['Так, скоріше погоджуюсь', '#FF685D90'],
  ['Важко відповісти', '#C8C6C6'],
  ['Важко сказати', '#C8C6C6'],
  ['Важко відповісти\\немає відповіді', '#C8C6C6'],
  ['Ні, повністю не погоджуюсь', '#000000'],
  ['Ні, скоріше не погоджуюсь', '#535353'],
]);

// Відповідність між назвами областей та SVG файлами
export const regionToSvgMap = {
  "Вінницька область": "Vinnytsia", "Волинська область": "Volyn",
  "Дніпропетровська область": "Dnipropetrovsk", "Донецька область": "Donetsk",
  "Житомирська область": "Zhytomyr", "Закарпатська область": "Zakarpattia",
  "Запорізька область": "Zaporizhzhia", "Івано-Франківська область": "Ivano-Frankivsk",
  "Київська область": "Kyiv", "Кіровоградська область": "Kirovohrad",
  "Луганська область": "Luhansk", "Львівська область": "Lviv",
  "Миколаївська область": "Mykolaiv", "Одеська область": "Odesa",
  "Полтавська область": "Poltava", "Рівненська область": "Rivne",
  "Сумська область": "Sumy", "Тернопільська область": "Ternopil",
  "Харківська область": "Kharkiv", "Херсонська область": "Kherson",
  "Хмельницька область": "Khmelnytskyi", "Черкаська область": "Cherkasy",
  "Чернівецька область": "Chernivtsi", "Чернігівська область": "Chernihiv",
  "АР Крим": "Crimea"
};

//
import { writable } from 'svelte/store';

export const surveysRaw = writable([]);
export const answerStats = writable([]);

export const regionAnimationData = writable([]);

export const selectedRegion = writable([]);
export const selectedDistrict = writable([]);

// Обчислює частоту відповідей щоразу після оновлення фільтрів
export function calculateStats(data, filters, questions = null) {
  // Спочатку фільтруємо дані
  const filteredData = data.filter(d =>
    Object.entries(filters).every(([key, values]) => {
      // Ці властивості не мають впливати на мапу
      if (['Область', 'Район', 'Школа'].includes(key)) return true;

      // Обробляємо фільтр за датами
      if (key === 'dateRange') {
        const dateStr = d["Дата заповнення анкети"];
        if (!dateStr || dateStr === "NA") return false;
        const recordDate = new Date(dateStr);
        return recordDate >= new Date(values.start) && recordDate <= new Date(values.end);
      }

      // Фільтри за питаннями
      return Array.isArray(values) ?
        (values.length === 0 || values.includes(d[key])) :
        d[key] !== values;
    })
  );

  // Обчислюємо частоту відповідей
  let freqMap = new Map();

  if (questions && questions.length > 0) {
    filteredData.forEach(record => {
      questions.forEach(question => {
        const answer = record[question];
        if (answer && answer !== "NA") {
          if (typeof answer === 'string' && answer.startsWith('[') && answer.endsWith(']')) {
            // Обробляємо питання з мультивідповідями
            let answers = [];
            let normalizedAnswer = answer
              .replace(/"/g, "'")
              .replace(/^'?\[|]'?$/g, '')
              .split(/', '/)
              .map(item => item.replace(/^'|'$/g, ''));

            answers = normalizedAnswer.filter(item => item.trim() !== '');

            // Розділяємо мультивідповіді на окремі
            answers.forEach(singleAnswer => {
              const key = `${question}||${singleAnswer}`;
              freqMap.set(key, (freqMap.get(key) || 0) + 1);
            });
          } else {
            // Рахуємо частоту відповідей у звичайних питаннях
            const key = `${question}||${answer}`;
            freqMap.set(key, (freqMap.get(key) || 0) + 1);
          }
        }
      });
    });
  }

  // Обчислюємо статистику по областях
  const regionCounts = {};
  filteredData.forEach(item => {
    const region = item['Область'];
    if (region && region !== 'NA') {
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    }
  });

  const values = Object.values(regionCounts);
  // Передаємо кількість анкет та інтенсивність кольору в залежності
  // від мінімальної та максимальної кількості анкет
  const regionStats = {
    counts: regionCounts,
    min: values.length ? Math.min(...values) : 0,
    max: values.length ? Math.max(...values) : 0
  };

  return {
    filteredData,
    freqMap,
    regionStats,
    totalCount: filteredData.length
  };
}

// Зафарбовує області та райони у кольори відповідно
// до кількості анкет відносно найбільшої
export function interpolateColor(intensity) {
  // Для нульової інтенсивності (відсутність даних) даємо сірий колір
  if (intensity === 0) return '#C8C6C6';

  // Світло-рожевий
  const light = [255, 224, 222];
  // Червоний
  const dark = [255, 104, 93];

  // Інтерполюємо між світлим (найнижча кількість) і темним (найбільша) кольорами
  const rgb = light.map((l, i) => Math.round(l + (dark[i] - l) * intensity));

  return `rgb(${rgb.join(',')})`;
}