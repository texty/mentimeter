import { crossfade } from 'svelte/transition';
import { quintOut } from 'svelte/easing';

// Функція для створення анімації переходу між елементами
export const [baseSend, baseReceive] = crossfade({
    delay: 5,           // Затримка перед початком анімації
    duration: 500,      // Тривалість анімації
    easing: quintOut,   // Функція плавності анімації
    fallback() {        // Резервна анімація якщо crossfade не працює
        return {
            delay: 100,     // Затримка для резервної анімації
            duration: 300,  // Тривалість резервної анімації
            css: (t) => `opacity: ${t};`  // Анімація прозорості
        };
    }
});

// Момент вильоту питання
export const send = (node, params) => {
    // Якщо передано параметр noAnimation, повернути анімацію з нульовою тривалістю
    if (params?.noAnimation) return { duration: 0 };
    // Інакше використовувати базову функцію вильоту
    return baseSend(node, params);
};
// Момент прильоту питання
export const receive = (node, params) => {
    // Якщо передано параметр noAnimation, повернути анімацію з нульовою тривалістю
    if (params?.noAnimation) return { duration: 0 };
    // Інакше використовувати базову функцію прильоту
    return baseReceive(node, params);
};

// Окрема анімація польоту SVG областей
export function flyFromMap(node, { region, animationData }) {
    const staticAnimData = animationData[region];
    // Якщо немає даних для області, не анімувати
    if (!staticAnimData) {
        return { duration: 0 };
    }

    // Пошук за ID області
    const sourceElement = document.getElementById(region);
    // Якщо елемент не знайдено, не анімувати
    if (!sourceElement) {
        return { duration: 0 };
    }

    // Отримання координат та розмірів елемента-джерела
    const currentFromRect = sourceElement.getBoundingClientRect();
    // Отримання координат та розмірів цільового елемента (куди летить)
    const toRect = node.getBoundingClientRect();

    // Обчислення різниці в позиціях (дельта)
    const deltaX = currentFromRect.left - toRect.left;
    const deltaY = currentFromRect.top - toRect.top;

    // Обчислення масштабування
    const scaleX = toRect.width ? currentFromRect.width / toRect.width : 1;
    const scaleY = toRect.height ? currentFromRect.height / toRect.height : 1;
    // Вибір мінімального масштабу для збереження пропорцій
    const scale = Math.min(scaleX, scaleY);

    // Пошук батьківського елемента з overflow налаштуваннями
    // для підтримки скролу у блоку фільтрів
    let overflowParent = node.parentElement;
    let originalOverflow = null;

    // Тимчасово змінити overflow на 'visible' щоб елемент не обрізався
    while (overflowParent) {
        const styles = window.getComputedStyle(overflowParent);
        if (styles.overflow !== 'visible' || styles.overflowY !== 'visible') {
            originalOverflow = styles.overflow;
            break;
        }
        overflowParent = overflowParent.parentElement;
    }

    return {
        delay: 1,          // Затримка перед початком
        duration: 500,     // Тривалість анімації
        easing: quintOut,  // Плавність анімації

        // Функція tick викликається протягом анімації
        tick: (t) => {
            // Під час анімації (до 95%) встановлювати overflow: visible
            if (t < 0.95 && overflowParent) {
                overflowParent.style.overflow = 'visible';
            }
            // Наприкінці анімації (після 95%) відновлювати оригінальний overflow
            else if (t >= 0.95 && overflowParent && originalOverflow) {
                overflowParent.style.overflow = originalOverflow;
            }
        },
        css: (t) => {
            // Обчислення поточної позиції (інтерполяція від початкової до кінцевої)
            const x = deltaX * (1 - t);
            const y = deltaY * (1 - t);
            // Обчислення поточного масштабу
            const currentScale = scale + (1 - scale) * t;

            // Повернення CSS стилів для анімації
            return `
                transform: translate(${x}px, ${y}px) scale(${currentScale});
                opacity: ${Math.min(1, t + 0.3)};
                position: relative;
            `;
        }
    };
}