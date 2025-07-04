<script>
  import * as d3 from 'd3';
  import { surveysRaw } from "$lib/store.js";

  // Фіксована висота графіка у 120px
  let { FILTERS = $bindable({}), height = 120 } = $props();

  let chartContainer = $state();
  let containerDiv = $state();
  let timelineData = $state([]);
  let maxValue = $state(0);
  let selectedRange = $state(null);
  let width = $state();

  // Масив місяців для підписів осі X
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  // Відступи для діаграми
  const margin = { top: 30, right: 15, bottom: 16, left: 10 };

  // Динамічна зміна розміру графіка
  let resizeObserver;
  $effect(() => {
    if (containerDiv) {
      const updateWidth = () => width = containerDiv.getBoundingClientRect().width;
      updateWidth();
      resizeObserver = new ResizeObserver(updateWidth);
      resizeObserver.observe(containerDiv);
      return () => resizeObserver?.disconnect();
    }
  });

  // Видалення діапазону дат з фільтру
  $effect(() => {
    if (!FILTERS.dateRange && selectedRange) clearSelection();
  });

  // Відображення даних на основі фільтрів
  const filteredDataDerived = $derived(() => {
    const data = $surveysRaw || [];
    return data.filter(d =>
      Object.entries(FILTERS).every(([key, values]) => {
        if (key === 'dateRange') return true; // dateRange не має впливати на сам графік
        if (Array.isArray(values)) return values.length === 0 || values.includes(d[key]);
        return d[key] === values;
      })
    );
  });

  // Створення часової шкали
  const timelineDataDerived = $derived(() => {
    const filtered = filteredDataDerived();
    if (!filtered.length) return { data: [], maxValue: 0 };

    // Групування даних за місяцями
    const dateGroups = {};
    filtered.forEach(d => {
      // Отримуємо дату з поля "Дата заповнення анкети"
      const dateStr = d["Дата заповнення анкети"];
      // Перевіряємо, чи існує дата і чи не є вона NA
      if (dateStr && dateStr !== "NA") {
        const date = new Date(dateStr);
        // date.getFullYear() - отримуємо рік
        // date.getMonth() + 1 - отримуємо місяць (додаємо 1, бо getMonth() повертає 0-11)
        // padStart(2, '0') - додаємо нуль на початок, якщо місяць односимвольний (01, 02, тощо.)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        // Збільшуємо лічильник для цього місяця
        dateGroups[monthKey] = (dateGroups[monthKey] || 0) + 1;
        // Тобто якщо дані в одному місяці, але за різні дні, вони
        // будуть об'єднані в межах одного місяця
      }
    });

    // Перетворення в масив анкет з сортуванням за датою
    const data = Object.entries(dateGroups)
      .map(([monthKey, count]) => ({
        month: monthKey,
        date: new Date(monthKey + '-01'),
        count: count
      }))
      .sort((a, b) => a.date - b.date);

    return { data, maxValue: Math.max(...data.map(d => d.count), 0) };
  });

  // Оновлення даних графіка
  $effect(() => {
    const timeline = timelineDataDerived();
    timelineData = timeline.data;
    maxValue = timeline.maxValue;
  });

  // Перемалювання діаграми при зміні даних
  $effect(() => {
    if (chartContainer && timelineData.length > 0 && width > 0) drawChart();
  });

  // Знаходження найближчої точки місяця до положення миші (ефект прилипання)
  function findNearestDataPoint(xPosition, xScale) {
    const mouseDate = xScale.invert(xPosition);
    const targetMonth = new Date(mouseDate.getFullYear(), mouseDate.getMonth(), 1);
    return timelineData.find(d => 
      d.date.getFullYear() === targetMonth.getFullYear() && 
      d.date.getMonth() === targetMonth.getMonth()
    ) || { date: targetMonth, count: 0 };
  }

  // Отримання точної X позиції для заданої дати
  function getExactXPosition(date, xScale) { return xScale(date); }

  // Для форматування дати в короткому форматі
  function formatShortDate(date) { return `${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`; }

  // Малювання діаграми
  function drawChart() {
    const svg = d3.select(chartContainer);
    svg.selectAll("*").remove(); // Очищення попереднього вмісту

    // Розрахунок внутрішніх розмірів
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Визначення розмірів осей
    const xScale = d3.scaleTime()
      .domain(d3.extent(timelineData, d => d.date))
      .range([0, innerWidth]);
    const yScale = d3.scaleLinear()
      .domain([0, Math.max(maxValue, 1)])
      .range([innerHeight, 0])
      .clamp(true);

    // Малювання висот
    const line = d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(Math.max(0, d.count)))
      .curve(d3.curveMonotoneX)
      .defined(d => d.count >= 0);
    const area = d3.area()
      .x(d => xScale(d.date))
      .y0(yScale(0))
      .y1(d => yScale(Math.max(0, d.count)))
      .curve(d3.curveMonotoneX)
      .defined(d => d.count >= 0);
    g.append("path").datum(timelineData).attr("fill", "rgba(255, 104, 93, 0.3)").attr("d", area);
    g.append("path").datum(timelineData).attr("fill", "none").attr("stroke", "rgb(255, 104, 93)").attr("stroke-width", 2).attr("d", line);

    // Створення нижньої осі X (місяці)
    const xAxisBottom = d3.axisBottom(xScale)
      .tickFormat(d => months[d.getMonth()] === '01' ? '' : months[d.getMonth()]);
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxisBottom)
      .selectAll("text")
      .style("font-size", "8px")
      .style("font-family", "Cy Grotesk")
      .style("font-weight", "300")

    // Додавання вертикальних ліній (роки)
    const years = xScale.ticks(d3.timeYear.every(1));
    g.selectAll("line.year-line")
      .data(years)
      .enter().append("line")
      .attr("class", "year-line")
      .attr("x1", d => xScale(d))
      .attr("x2", d => xScale(d))
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .attr("stroke", "#000")
      .attr("stroke-width", 1);

    // Створення верхньої осі X (підпис років)
    const xAxisTop = d3.axisTop(xScale)
      .ticks(d3.timeYear.every(1))
      .tickFormat(d => d3.timeFormat("%Y")(d) + " р.");
    g.append("g")
      .attr("class", "x axis top")
      .call(xAxisTop)
      .selectAll("text")
      .style("font-size", "10px")
      .style("font-family", "Cy Grotesk")
      .style("text-anchor", "middle")
      .attr("dy", "-10px");
    g.select(".x.axis.top").select(".domain").remove();

    // Вибір діапазону
    const brushGroup = g.append("g").attr("class", "brush-group");
    // Початкові координати діапазону
    let currentStartX = selectedRange ? xScale(selectedRange.start) : innerWidth * 0.3;
    let currentEndX = selectedRange ? xScale(selectedRange.end) : innerWidth * 0.7;
    const selectionRect = brushGroup.append("rect").attr("class", "selection-rect")
      .attr("y", 0).attr("height", innerHeight).style("cursor", "default").style("pointer-events", "none");
    // Визначення областей за які можна перетягувати діапазон у відповідні сторони
    const leftHandle = brushGroup.append("rect").attr("class", "left-handle")
      .attr("y", 0).attr("height", innerHeight).attr("opacity", 0).style("cursor", "ew-resize");
    const rightHandle = brushGroup.append("rect").attr("class", "right-handle")
      .attr("y", 0).attr("height", innerHeight).attr("opacity", 0).style("cursor", "ew-resize");
    // Текст для відображення вибраного діапазону
    const selectionText = brushGroup.append("text").attr("class", "selection-text")
      .attr("y", -5).attr("text-anchor", "middle").style("font-size", "10px");

    // Кнопка для очищення вибору
    let clearButton = null;
    if (selectedRange) {
      clearButton = brushGroup.append("g").attr("class", "clear-button").style("cursor", "pointer");
      clearButton.append("circle").attr("cx", innerWidth - 15).attr("cy", 14).attr("r", 8).attr("fill", "#0064c8");
      clearButton.append("text").attr("x", innerWidth - 15).attr("y", 19).attr("text-anchor", "middle")
        .style("font-size", "16px").style("fill", "white").style("font-weight", "bold").text("×");
    }

    // Візуальне оновлення графіка
    function updateDisplay() {
      let visualStartX = currentStartX, visualEndX = currentEndX;

      // Прив'язка до найближчих точок даних
      if (selectedRange) {
        const startPoint = findNearestDataPoint(currentStartX, xScale);
        const endPoint = findNearestDataPoint(currentEndX, xScale);
        if (startPoint && endPoint) {
          visualStartX = getExactXPosition(startPoint.date, xScale);
          visualEndX = getExactXPosition(endPoint.date, xScale);
        }
      }

      // Розрахунок розмірів елементів
      const selectionWidth = visualEndX - visualStartX;
      const handleWidth = selectionWidth * 0.5;

      // Оновлення позицій елементів
      selectionRect.attr("x", visualStartX).attr("width", selectionWidth);
      leftHandle.attr("x", visualStartX - 5).attr("width", handleWidth + 5);
      rightHandle.attr("x", visualEndX - handleWidth).attr("width", handleWidth + 5);
      selectionText.attr("x", (visualStartX + visualEndX) / 2);

      // Стилізація залежно від стану вибору
      if (selectedRange) {
        const startPoint = findNearestDataPoint(currentStartX, xScale);
        const endPoint = findNearestDataPoint(currentEndX, xScale);

        selectionRect.attr("fill", "rgba(0, 100, 200, 0.2)").attr("stroke", "rgba(0, 100, 200, 0.8)");
        leftHandle.attr("fill", "#0064c8");
        rightHandle.attr("fill", "#0064c8");
        selectionText.style("fill", "#0064c8").text(`${formatShortDate(startPoint.date)} - ${formatShortDate(endPoint.date)}`);
        selectionText.style("font-family", "Cy Grotesk");
      } else {
        selectionRect.attr("fill", "rgba(150, 150, 150, 0.3)").attr("stroke", "rgba(150, 150, 150, 0.5)");
        leftHandle.attr("fill", "#999");
        rightHandle.attr("fill", "#999");
        selectionText.style("fill", "#999").text("Оберіть діапазон");
        selectionText.style("font-family", "Cy Grotesk");
      }
    }

    // Оновлення фільтрів на основі вибору діапазону
    function updateSelection() {
      const startPoint = findNearestDataPoint(currentStartX, xScale);
      const endPoint = findNearestDataPoint(currentEndX, xScale);

      if (startPoint && endPoint && startPoint.date.getTime() !== endPoint.date.getTime()) {
        // Встановлення діапазону дат
        const startDate = startPoint.date < endPoint.date ? startPoint.date : endPoint.date;
        const endDate = startPoint.date < endPoint.date ? endPoint.date : startPoint.date;

        // Об'єднуємо дні місяця в один місяць
        selectedRange = {
          start: new Date(startDate.getFullYear(), startDate.getMonth(), 1),
          end: new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0, 23, 59, 59, 999)
        };

        // Оновлення фільтрів
        const startDateStr = selectedRange.start.toISOString().split('T')[0];
        const endDateStr = selectedRange.end.toISOString().split('T')[0];
        FILTERS = {
          ...FILTERS,
          dateRange: { start: startDateStr, end: endDateStr }
        };
      } else {
        // Очищення вибору
        selectedRange = null;
        const newFilters = { ...FILTERS };
        delete newFilters.dateRange;
        FILTERS = newFilters;
      }
      updateDisplay();
    }

    updateDisplay();

    // Налаштування перетягування для лівого та правого країв
    [leftHandle, rightHandle].forEach((handle, isRight) => {
      handle.call(d3.drag()
        .on("start", function(event) { this.hasMoved = false; })
        .on("drag", function(event) {
          const mouseX = d3.pointer(event, g.node())[0];
          const constrainedX = isRight ? 
            Math.max(currentStartX, Math.min(mouseX, innerWidth)) :
            Math.max(0, Math.min(mouseX, currentEndX));

          this.hasMoved = true;
          const nearestPoint = findNearestDataPoint(constrainedX, xScale);

          if (nearestPoint) {
            if (isRight) currentEndX = getExactXPosition(nearestPoint.date, xScale);
            else currentStartX = getExactXPosition(nearestPoint.date, xScale);
            updateDisplay();
          }
        })
        .on("end", function() { if (this.hasMoved) updateSelection(); })
      );
    });

    if (clearButton) {
      clearButton.on("click", () => clearSelection());
    }
  }

  // Кнопка очищення вибору
  export function clearSelection() {
    selectedRange = null;
    const newFilters = { ...FILTERS };
    delete newFilters.dateRange;
    FILTERS = newFilters;

    if (chartContainer) drawChart();
  }
</script>

<div class="container" bind:this={containerDiv}>
  {#if timelineData.length > 0}
    <!-- Власне сам графік -->
    <svg bind:this={chartContainer} {width} {height}></svg>
  {:else}
    <!-- Якщо немає даних, відображаємо повідомлення -->
    <div class="no-data">
      <p>Немає даних для відображення</p>
    </div>
  {/if}
</div>

<style>
  p {
    font-family: 'Cy Grotesk';
  }

  .container {
    width: 100%;
    align-self: flex-end;
  }
  .no-data {
    text-align: center;
    padding: 20px;
    color: #666;
  }
  .no-data p {
    margin: 0;
    font-size: 12px;
  }

  :global(.tooltip) {
    z-index: 1000;
  }
  :global(.brush-group .selection-rect) {
    transition: fill 0.2s ease, stroke 0.2s ease;
  }
  :global(.brush-group .left-handle),
  :global(.brush-group .right-handle) {
    transition: fill 0.2s ease;
  }
  :global(.clear-button) {
    transition: opacity 0.2s ease;
  }

  @media screen and (max-width: 800px) {
    .container {
      grid-column: 1 / -1;
      margin-top: 15px;
    }
  }
</style>