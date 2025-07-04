import csv, os, re, io
import pandas as pd
from rapidfuzz import process, fuzz

# ====================================
# КОНФІГУРАЦІЯ
# ====================================

# Якщо однакові питання будуть мати невеликі відмінності, вони все одно
# мають вважатись як одне ціле. Для цього використовуємо поріг схожості.
# Якщо питання короткі, схожі на інші або мають інші особливості,
# тоді ми записуємо їх у питання з високим порогом схожості (95%)
# щоб гарантувати правильний вибір. Щоб визначити підходящу строку,
# порівнюйте між собою питання у файлі check.py

# Питання з мультивідповідями записуємо у HIGH_PRIORITY_QUESTIONS

# Щоб питання вважалось однаковим, поріг схожості
# має бути не нижче 52%
SIMILARITY_THRESHOLD = 52
# Щоб питання вважалось однаковим, поріг схожості
# має бути не нижче 95%
HIGH_SIMILARITY_THRESHOLD = 95

# Створюємо шлях до вихідного файлу
script_dir = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILENAME = os.path.join(script_dir, "surveys.csv")

# ====================================
# ПИТАННЯ
# ====================================

# Питання, які ми шукаємо у файлах
QUESTIONS = {
    "Бізнесмен - це той, хто всіма способами ухиляється від сплати податків, має багато грошей і нічого не робить",
    "Бізнесмен - це той, хто забезпечує розвиток економіки і наполегливо працює задля досягнення успіху",
    "В Україні заробляти багато грошей чесним шляхом – неможливо",
    "В Україні існує достатньо можливостей заробляти багато грошей чесним способом",
    "В Україні незаможні люди, зазвичай, є кращими, ніж люди із великими статками",
    "Визнати правду іншого в дискусії – це слабкість, навіть якщо правий інший",
    "Говорити про секс – соромно",
    "Для суспільства культура та мистецтво менш важливі, ніж деякі інші аспекти",
    "За погану дорогу в селі, в першу чергу, несе відповідальність…",
    "Запорукою успіху в житті є…?",
    "Керівництво держави має отримувати заробітну плату не більше ніж середньостатистичний громадянин",
    "ЛГБТ-людей треба вилікувати чи виправити",
    "Мати хороше життя, народившись в селі, майже не реально",
    "Мешканці столиці є більш важливими для суспільства, ніж мешканці сіл і маленьких містечок",
    "Наскільки, на твій погляд, нинішня політична система в Україні дозволяє таким людям, як Ти, впливати на політику?",
    "Наука – це щось нудне й далеке від практичного життя",
    "Помилятись – це погано і ознака поразки та неуспіху",
    "Пропозиції «швидко розбагатіти в інтернеті» можуть бути дійсно хорошими",
    "Що ти думаєш про майбутнє України?",
    "Який основний мотив людей в Україні, які йдуть у політику чи на державну службу?",
    "Якщо щось пішло не так – у першу чергу потрібно знайти винних і покарати їх",
    "Хто така еліта?",
    "Вчитись потрібно в першу чергу тому що…?",
    "Для вирішення проблеми корупції потрібно посадити всіх корупціонерів за грати",
    "Якою мірою слід дозволяти переїжджати до України людям іншої раси чи національності",
    "Який із запропонованих сценаріїв життя був би найбільш прийнятним для тебе?",
    "Ким ти себе перш за все вважаєш?",
    "Якщо є людина, що курила і дожила до 100 років, то куріння не є таким шкідливим, як про це говорять",
    "Чи вважаєш ти себе щасливою людиною? постав позначку на шкалі, де 1 - дуже нещасливий, 5 - дуже щасливий",
    "Для мене гідність залежить від мого успіху та визнання іншими",
    "Кому ти найбільше довіряєш?",
    "Якщо щось пішло не так – у першу чергу треба знайти винних і покарати чи знайти збої в системі і причини помилки? 1 - знайти винних; 5 - знайти збої і причини",
}

# Високопріоритетні питання - обробляються з вищим порогом схожості
HIGH_PRIORITY_QUESTIONS = {
    "Вкажи, будь ласка, свій вік",
    "Вкажи, будь ласка, свою стать",
    "З якими проблемами ти можеш звернутися до батьків або інших дорослих, які про тебе піклуються?",
    "Чи вистачає тобі спілкування з батьками/іншими дорослими, які тебе опікають?",
}

# Перейменування питань для високопріоритетних питань
HIGH_PRIORITY_HEADERS = {
   "Вкажи, будь ласка, свій вік": "Вік",
   "Вкажи, будь ласка, свою стать": "Стать",
}

# ====================================
# ОБРОБКА ДАНИХ
# ====================================

def clean_answer(text):
    """
    Очищає відповідь від зайвих символів
    Замінює "0" на "1"
    Записує у полі "NA" якщо порожнє значення
    """
    return "1" if text == "0" else (text.strip() if text else "NA")

def clean_filename(filename):
    """
    Витягує назву школи та району з назв файлів
    Назва школи - це назва файлу
    Назва району - назва в дужках,
    # Приклад: Глуховецький ліцей (Хмільницький район)
    """
    # Витягуємо назву школи (все до дужок)
    school_match = re.match(r"^(.+?)\s*\(", filename)
    school_name = school_match.group(1).strip() if school_match else filename

    # Витягуємо назву району (все в дужках) та видаляємо слово "район"
    district_match = re.search(r"\((.+?)\)", filename)
    if district_match:
        district_name = district_match.group(1).strip()
        # Видаляємо слово "район" з назви
        district_name = re.sub(r"\s*район\s*", "", district_name, flags=re.IGNORECASE).strip()
    else:
        district_name = "NA"

    return school_name, district_name

def read_file_content(filename):
    # Читаємо CSV файл
    if filename.endswith(".csv"):
        with open(filename, "r", encoding="utf-8") as f:
            content = f.read()
    # Читаємо XLSX файл та конвертуємо в CSV
    elif filename.endswith(".xlsx"):
        df = pd.read_excel(filename, dtype=str)
        if df.empty:
            print(f"Помилка: Файл {filename} порожній.")
            return None
        content = df.to_csv(index=False)
    else:
        return None

    # Розділяємо вміст на рядки
    lines = content.splitlines()
    header_line_index = -1

    # Шукаємо рядок з заголовками (який містить питання з нашого списку)
    for i, line in enumerate(lines):
        if any(question in line for question in QUESTIONS):
            header_line_index = i
            break

    # Якщо знайшли питання, беремо все починаючи з них
    if header_line_index != -1:
        lines = lines[header_line_index:]

    return "\n".join(lines)

def create_column_mappings(fieldnames):
    column_mapping = {}
    high_priority_mapping = {q: [] for q in HIGH_PRIORITY_QUESTIONS}

    # Обробляємо звичайні питання
    for column in fieldnames:
        # Шукаємо найбільш схожу колонку для кожного питання
        best_match = process.extractOne(column, QUESTIONS, scorer=fuzz.ratio)
        if best_match and best_match[1] >= SIMILARITY_THRESHOLD:
            column_mapping[best_match[0]] = column

        # Обробляємо високопріоритетні питання з вищим порогом схожості
        high_match = process.extractOne(column, HIGH_PRIORITY_QUESTIONS, scorer=fuzz.ratio)
        if high_match and high_match[1] >= HIGH_SIMILARITY_THRESHOLD:
            high_priority_mapping[high_match[0]].append(column)

    return column_mapping, high_priority_mapping

def process_row(row, school_name, district_name, area_name, column_mapping, high_priority_mapping):
    """
    Окрім питань, які знаходяться у файлах, додаємо також
    school_name: Назва школи
    district_name: Назва району
    area_name: Назва області
    Date: Дату заповнення анкети
    """
    # Початкові колонки: школа, район, область, дата
    row_data = [school_name, district_name, area_name, row.get("Date", "NA")]

    # Обробляємо звичайні питання
    for question in QUESTIONS:
       # Отримуємо значення з відповідної колонки
       value = row.get(column_mapping.get(question, ""), "NA")

       # Спеціальна обробка для цього питання
       # Видаляє пробіли та дефіси які присутні у деяких файлах
       if question == "Хто така еліта?":
           value = value.replace("-", "").strip() if value else "NA"
       else:
           value = clean_answer(value)
       row_data.append(value)

    # Обробляємо високопріоритетні питання
    for question in HIGH_PRIORITY_QUESTIONS:
       columns = high_priority_mapping[question]
       # Збираємо всі непорожні відповіді для цього питання
       values = [clean_answer(row.get(col, "NA")) for col in columns if row.get(col, "").strip()]
       # Беремо першу відповідь, якщо є одна, або всі у вигляді списку
       row_data.append(values[0] if len(values) == 1 else str(values) if values else "NA")

    return row_data

def check_questions_in_file(column_mapping, high_priority_mapping):
    """
    Перевіряє, які питання знайдено в поточному файлі
    """
    found_questions = set()
    found_high_priority = set()

    # Перевіряємо звичайні питання
    for question in QUESTIONS:
        if question in column_mapping and column_mapping[question]:
            found_questions.add(question)

    # Перевіряємо високопріоритетні питання
    for question in HIGH_PRIORITY_QUESTIONS:
        if question in high_priority_mapping and high_priority_mapping[question]:
            found_high_priority.add(question)

    return found_questions, found_high_priority

# ====================================
# ОСНОВНА ФУНКЦІЯ
# ====================================

def main():
    """
    1. Знаходить всі CSV/XLSX файли в поточній директорії
    2. Обробляє кожен файл та витягує відповіді на питання
    3. Зберігає результати в один зведений CSV файл
    4. Виводить статистику по відсутніх питаннях
    """
    # Отримуємо шлях до директорії скрипта
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Знаходимо всі CSV та XLSX файли в поточній директорії та підпапках
    data_files = [
        os.path.join(root, file)
        for root, _, files in os.walk(script_dir)
        # Обмежуємося поточною директорією та її підпапками
        if root == script_dir or os.path.dirname(root) == script_dir
        for file in files
        # Фільтруємо файли за розширенням та виключаємо вихідний файл
        if file.endswith((".csv", ".xlsx")) and file != OUTPUT_FILENAME
    ]

    # Перевіряємо, чи знайшли файли для обробки
    if not data_files:
        print("Помилка: У поточній папці немає CSV або XLSX файлів для обробки.")
        return

    # Ініціалізуємо статистику для відстеження відсутніх питань
    question_stats = {q: {"count": 0, "missing_files": []} for q in QUESTIONS}
    high_priority_stats = {q: {"count": 0, "missing_files": []} for q in HIGH_PRIORITY_QUESTIONS}

    # Відкриваємо вихідний файл для запису
    with open(OUTPUT_FILENAME, "w", newline="", encoding="utf-8") as outfile:
        writer = csv.writer(outfile)

        # Записуємо заголовки результуючого файлу
        writer.writerow(["Школа", "Область", "Район", "Дата заповнення анкети"] + 
              list(QUESTIONS) + [HIGH_PRIORITY_HEADERS.get(q, q) for q in HIGH_PRIORITY_QUESTIONS])

        # Обробляємо кожен файл
        for filename in data_files:
            print(f"Обробляємо файл: {filename}")

            # Витягуємо метадані з назви файлу
            school_name, district_name = clean_filename(os.path.splitext(os.path.basename(filename))[0])
            area_name = os.path.basename(os.path.dirname(filename))

            # Читаємо вміст файлу
            content = read_file_content(filename)
            if not content:
                print(f"Пропускаємо файл {filename} - не вдалося прочитати")
                continue

            # Створюємо CSV reader та аналізуємо заголовки
            reader = csv.DictReader(io.StringIO(content))
            column_mapping, high_priority_mapping = create_column_mappings(reader.fieldnames)

            # Визначаємо, які питання знайдено в цьому файлі
            found_questions, found_high_priority = check_questions_in_file(column_mapping, high_priority_mapping)

            # Обробляємо кожен рядок файлу
            for row in reader:
                row_data = process_row(row, school_name, area_name, district_name, column_mapping, high_priority_mapping)

                # Пропускаємо порожні рядки (де всі відповіді NA або порожні)
                if all(value == "NA" or value == "" for value in row_data[4:]):
                    continue

                # Записуємо оброблений рядок
                writer.writerow(row_data)

            # Оновлюємо статистику для звичайних питань
            for question in QUESTIONS:
                if question in found_questions:
                    question_stats[question]["count"] += 1
                else:
                    question_stats[question]["missing_files"].append(school_name)

            # Оновлюємо статистику для високопріоритетних питань
            for question in HIGH_PRIORITY_QUESTIONS:
                if question in found_high_priority:
                    high_priority_stats[question]["count"] += 1
                else:
                    high_priority_stats[question]["missing_files"].append(school_name)

    print(f"Дані успішно записано у '{OUTPUT_FILENAME}'.")

    # Виводимо звіт про відсутні питання
    # Це не завжди помилка, інколи їх там дійсно немає
    # Це дозволяє перевірити чи правильно налаштований поріг
    # для всіх питань
    max_files = len(data_files)
    missing_found = False

    # Перевіряємо звичайні питання
    for question, stats in question_stats.items():
        missing_count = max_files - stats["count"]
        if missing_count > 0:
            missing_files = ", ".join(stats["missing_files"])
            print(f"\n- {question}: не знайдено у {missing_count} файлах ({missing_files})")
            missing_found = True

    # Перевіряємо високопріоритетні питання
    for question, stats in high_priority_stats.items():
        missing_count = max_files - stats["count"]
        if missing_count > 0:
            missing_files = ", ".join(stats["missing_files"])
            print(f"\n- {question} (high priority): не знайдено у {missing_count} файлах ({missing_files})")
            missing_found = True

    # Якщо всі питання знайдено
    if not missing_found:
        print("\nВсі питання знайдені у всіх файлах!")

if __name__ == "__main__":
    main()