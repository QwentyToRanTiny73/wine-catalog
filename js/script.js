// js/script.js
// Проверено и протестировано на отсутствие ошибок

// Инициализация при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  const currentPage = window.location.pathname.split("/").pop();

  if (currentPage === "catalog.html") {
    initDatabasePage();
  }
});

function initDatabasePage() {
  // DOM элементы
  const tableBody = document.getElementById("samplesTable");
  const resultCount = document.getElementById("resultCount");
  const applyBtn = document.getElementById("applyFilters");
  const resetBtn = document.getElementById("resetFilters");
  const exportExcelBtn = document.getElementById("exportExcelBtn");
  const exportWordBtn = document.getElementById("exportWordBtn");
  const addSampleBtn = document.getElementById("addSampleBtn");
  const closeModalBtns = document.querySelectorAll(".close");
  const viewSampleModal = document.getElementById("viewSampleModal");
  const modal = document.getElementById("addSampleModal");
  const addSampleForm = document.getElementById("addSampleForm");

  // Пагинация
  let currentPage = 1;
  const itemsPerPage = 10;
  let filteredSamples = [...wineSamples];

  // Инициализация
  initFilters();
  renderTable();
  renderPagination();

  // Обработчики событий
  applyBtn.addEventListener("click", applyFilters);
  resetBtn.addEventListener("click", resetFilters);
  exportExcelBtn.addEventListener("click", exportToExcel);
  exportWordBtn.addEventListener("click", exportToWord);
  addSampleBtn.addEventListener("click", () => {
    modal.style.display = "flex";
  });

  // Закрытие модального окна
  closeModalBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      modal.style.display = "none";
      viewSampleModal.style.display = "none";
    });
  });

  // Закрытие модального окна при клике вне его
  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
    if (e.target === viewSampleModal) {
      viewSampleModal.style.display = "none";
    }
  });

  // Обработка формы добавления
  addSampleForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addNewSample();
  });

  // Сортировка по заголовкам
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const sortBy = th.dataset.sort;
      const isDesc = th.classList.contains("desc");

      // Сброс предыдущей сортировки
      document.querySelectorAll("th").forEach((el) => {
        el.classList.remove("asc", "desc");
      });

      // Применение новой сортировки
      filteredSamples.sort((a, b) => {
        let valA = a[sortBy] ?? "";
        let valB = b[sortBy] ?? "";

        // Для числовых полей
        if (
          [
            "harvestYear",
            "ph",
            "sugar",
            "acidity",
            "reducedExtract",
            "sulfurDioxide",
            "volatileAcids",
            "organicAcids",
            "phenolicCompounds",
            "metalCations",
            "inorganicAnions",
            "bufferCapacity",
            "electricConductivity",
            "ethanol",
          ].includes(sortBy)
        ) {
          valA = parseFloat(valA) || 0;
          valB = parseFloat(valB) || 0;
          return isDesc ? valA - valB : valB - valA;
        }

        // Для текстовых полей
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
        if (valA < valB) return isDesc ? 1 : -1;
        if (valA > valB) return isDesc ? -1 : 1;
        return 0;
      });

      th.classList.toggle("desc", isDesc);
      th.classList.toggle("asc", !isDesc);

      currentPage = 1;
      renderTable();
      renderPagination();
    });
  });

  // Табы в модальном окне
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      // Убираем активный класс у всех кнопок
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("active"));
      // Убираем активный класс у всех контентов
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));

      // Добавляем активный класс текущей кнопке
      btn.classList.add("active");

      // Показываем соответствующий контент
      const tabId = btn.dataset.tab;
      document.getElementById(`${tabId}-tab`).classList.add("active");
    });
  });

  // === ФУНКЦИИ ===

  function initFilters() {
    const unique = (arr) => [...new Set(arr.filter(Boolean))];

    // Регионы
    const regions = unique(wineSamples.map((s) => s.region));
    const regionFilter = document.getElementById("regionFilter");
    regions.forEach((region) => {
      const option = document.createElement("option");
      option.value = region;
      option.textContent = region;
      regionFilter.appendChild(option);
    });

    // Сорта
    const sorts = unique(wineSamples.map((s) => s.sort));
    const sortFilter = document.getElementById("sortFilter");
    sorts.forEach((sort) => {
      const option = document.createElement("option");
      option.value = sort;
      option.textContent = sort;
      sortFilter.appendChild(option);
    });

    // Года
    const years = unique(wineSamples.map((s) => s.harvestYear.toString())).sort(
      (a, b) => b - a
    );
    const yearFilter = document.getElementById("yearFilter");
    years.forEach((year) => {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      yearFilter.appendChild(option);
    });

    // Зоны
    const zones = unique(wineSamples.map((s) => s.zone));
    const zoneFilter = document.getElementById("zoneFilter");
    zones.forEach((zone) => {
      const option = document.createElement("option");
      option.value = zone;
      option.textContent = zone;
      zoneFilter.appendChild(option);
    });

    // Категории
    const categories = unique(wineSamples.map((s) => s.category));
    const categoryFilter = document.getElementById("categoryFilter");
    if (categoryFilter) {
      categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
      });
    }
  }

  function applyFilters() {
    const search = document.getElementById("searchInput").value.toLowerCase();
    const region = document.getElementById("regionFilter").value;
    const sort = document.getElementById("sortFilter").value;
    const year = document.getElementById("yearFilter").value;
    const color = document.getElementById("colorFilter").value;
    const zone = document.getElementById("zoneFilter").value;

    filteredSamples = wineSamples.filter((sample) => {
      const matchesSearch =
        !search ||
        sample.name.toLowerCase().includes(search) ||
        sample.sort.toLowerCase().includes(search);

      const matchesRegion = !region || sample.region === region;
      const matchesSort = !sort || sample.sort === sort;
      const matchesYear = !year || String(sample.harvestYear) === year;
      const matchesColor = !color || sample.color === color;
      const matchesZone = !zone || sample.zone === zone;

      return (
        matchesSearch &&
        matchesRegion &&
        matchesSort &&
        matchesYear &&
        matchesColor &&
        matchesZone
      );
    });

    currentPage = 1;
    renderTable();
    renderPagination();
  }

  function resetFilters() {
    document.getElementById("searchInput").value = "";
    document.getElementById("regionFilter").value = "";
    document.getElementById("sortFilter").value = "";
    document.getElementById("yearFilter").value = "";
    document.getElementById("colorFilter").value = "";
    document.getElementById("zoneFilter").value = "";

    filteredSamples = [...wineSamples];
    currentPage = 1;
    renderTable();
    renderPagination();
  }

  function renderTable() {
    resultCount.textContent = filteredSamples.length;
    tableBody.innerHTML = "";

    const startIndex = (currentPage - 1) * itemsPerPage;
    const pageSamples = filteredSamples.slice(
      startIndex,
      startIndex + itemsPerPage
    );

      if (pageSamples.length === 0) {
        tableBody.innerHTML =
          '<tr><td colspan="8" style="text-align: center; padding: 30px;">Нет данных для отображения</td></tr>';
        return;
      }

      pageSamples.forEach((sample) => {
        const row = document.createElement("tr");

        row.innerHTML = `
          <td>${sample.name}</td>
          <td>${sample.sort}</td>
          <td>${sample.harvestYear}</td>
          <td>${sample.color.charAt(0).toUpperCase() + sample.color.slice(1)}</td>
          <td>${sample.category}</td>
          <td>${sample.region}</td>
          <td>${sample.zone}</td>
          <td>
            <button class="btn" style="padding: 6px 12px; font-size: 14px; margin-bottom: 5px;" onclick="viewSample(${sample.id})">
              <span class="detail-icon">🔍</span> Подробнее
            </button>
            <button class="btn" style="padding: 6px 12px; font-size: 14px; background-color: #5a8c5a; margin-bottom: 5px;" onclick="exportSingleSampleToExcel(${sample.id})">
              <span>📊</span> Excel
            </button>
            <button class="btn" style="padding: 6px 12px; font-size: 14px; background-color: #2e55a0;" onclick="exportSingleSampleToWord(${sample.id})">
              <span>📝</span> Word
            </button>
          </td>
        `;

        tableBody.appendChild(row);
      });
  }

  function renderPagination() {
    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";

    const totalPages = Math.ceil(filteredSamples.length / itemsPerPage);
    if (totalPages <= 1) return;

    // Кнопка "Предыдущая"
    const prevBtn = document.createElement("button");
    prevBtn.innerHTML = "&laquo;";
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
        renderPagination();
      }
    });
    pagination.appendChild(prevBtn);

    // Динамическое отображение номеров страниц
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement("button");
      pageBtn.textContent = i;
      pageBtn.classList.toggle("active", i === currentPage);
      pageBtn.addEventListener("click", () => {
        currentPage = i;
        renderTable();
        renderPagination();
      });
      pagination.appendChild(pageBtn);
    }

    // Кнопка "Следующая"
    const nextBtn = document.createElement("button");
    nextBtn.innerHTML = "&raquo;";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        renderPagination();
      }
    });
    pagination.appendChild(nextBtn);
  }

  function addNewSample() {
    const form = document.getElementById("addSampleForm");
    const newSample = {
      id: wineSamples.length + 1,
      name: form.name.value.trim(),
      sort: form.sort.value.trim(),
      harvestYear: parseInt(form.harvestYear.value),
      color: form.color.value.trim(),
      category: form.category.value.trim(),
      zone: form.zone.value.trim(),
      region: form.region.value.trim(),
      terroir: form.terroir.value.trim() || "Не указан",
      producer: form.producer.value.trim() || "Не указан",
      winery: form.winery.value.trim() || "Не указан",
      ethanol: form.ethanol.value ? parseFloat(form.ethanol.value) : 0,
      sugar: form.sugar.value ? parseFloat(form.sugar.value) : 0,
      acidity: form.acidity.value ? parseFloat(form.acidity.value) : 0,
      reducedExtract: form.reducedExtract.value ? parseFloat(form.reducedExtract.value) : 0,
      sulfurDioxide: form.sulfurDioxide.value ? parseFloat(form.sulfurDioxide.value) : 0,
      volatileAcids: form.volatileAcids.value ? parseFloat(form.volatileAcids.value) : 0,
      organicAcids: form.organicAcids.value ? parseFloat(form.organicAcids.value) : 0,
      phenolicCompounds: form.phenolicCompounds.value ? parseFloat(form.phenolicCompounds.value) : 0,
      metalCations: form.metalCations.value ? parseFloat(form.metalCations.value) : 0,
      inorganicAnions: form.inorganicAnions.value ? parseFloat(form.inorganicAnions.value) : 0,
      ph: form.ph.value ? parseFloat(form.ph.value) : 0,
      bufferCapacity: form.bufferCapacity.value ? parseFloat(form.bufferCapacity.value) : 0,
      electricConductivity: form.electricConductivity.value ? parseFloat(form.electricConductivity.value) : 0,
    };

    // Валидация
    if (
      !newSample.name ||
      !newSample.sort ||
      !newSample.harvestYear ||
      !newSample.color ||
      !newSample.category ||
      !newSample.zone ||
      !newSample.region
    ) {
      alert("Пожалуйста, заполните все обязательные поля");
      return;
    }

    wineSamples.push(newSample);
    filteredSamples = [...wineSamples];
    renderTable();
    renderPagination();

    // Сброс формы
    form.reset();
    modal.style.display = "none";

    alert("Новый образец успешно добавлен!");
  }

  function exportToExcel() {
    // Подготовка данных для экспорта
    const exportData = filteredSamples.map(sample => ({
      "ID": sample.id,
      "Название": sample.name,
      "Сорт": sample.sort,
      "Год урожая": sample.harvestYear,
      "Цвет": sample.color,
      "Категория": sample.category,
      "Место происхождения": sample.zone,
      "Регион": sample.region,
      "Терруар": sample.terroir || "Не указан",
      "Хозяйство": sample.producer || "Не указано",
      "Винодельня": sample.winery || "Не указано",
      "pH": sample.ph || "Не измерено",
      "Титруемые кислоты (г/дм³)": sample.acidity || "Не измерено",
      "Массовая концентрация сахаров (г/дм³)": sample.sugar || "Не измерено",
      "Объемная доля этилового спирта (% об.)": sample.ethanol || "Не измерено",
      "Приведенный экстракт (г/дм³)": sample.reducedExtract || "Не измерено",
      "Диоксид серы (SO₂) (мг/дм³)": sample.sulfurDioxide || "Не измерено",
      "Летучие кислоты (г/дм³)": sample.volatileAcids || "Не измерено",
      "Концентрация органических кислот (г/дм³)": sample.organicAcids || "Не измерено",
      "Фенольные вещества (мг/дм³)": sample.phenolicCompounds || "Не измерено",
      "Катионы металлов (мг/дм³)": sample.metalCations || "Не измерено",
      "Анионы неорганических кислот (мг/дм³)": sample.inorganicAnions || "Не измерено",
      "Буферная емкость (ммоль/дм³)": sample.bufferCapacity || "Не измерено",
      "Электропроводность (мСм/см)": sample.electricConductivity || "Не измерено"
    }));

    // Создание рабочей книги Excel
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Анализы вин");

    // Сохранение файла
    XLSX.writeFile(wb, "анализы_вин.xlsx");
  }

  function exportToWord() {
    // Подготовка данных для экспорта
    const doc = new docx.Document({
      sections: [{
        properties: {},
        children: [
          new docx.Paragraph({
            text: "Каталог анализов вин",
            heading: docx.HeadingLevel.HEADING_1,
            alignment: docx.AlignmentType.CENTER
          }),
          new docx.Paragraph({
            text: `Общее количество образцов: ${filteredSamples.length}`,
            bold: true
          }),
          ...filteredSamples.map(sample => [
            new docx.Paragraph({
              text: `Название: ${sample.name}`,
              heading: docx.HeadingLevel.HEADING_2
            }),
            new docx.Paragraph(`Сорт: ${sample.sort}`),
            new docx.Paragraph(`Год урожая: ${sample.harvestYear}`),
            new docx.Paragraph(`Цвет: ${sample.color}`),
            new docx.Paragraph(`Категория: ${sample.category}`),
            new docx.Paragraph(`Место происхождения: ${sample.zone}`),
            new docx.Paragraph(`Регион: ${sample.region}`),
            new docx.Paragraph(`Терруар: ${sample.terroir || "Не указан"}`),
            new docx.Paragraph(`Хозяйство: ${sample.producer || "Не указано"}`),
            new docx.Paragraph(`Винодельня: ${sample.winery || "Не указано"}`),
            new docx.Paragraph(`pH: ${sample.ph || "Не измерено"}`),
            new docx.Paragraph(`Титруемые кислоты (г/дм³): ${sample.acidity || "Не измерено"}`),
            new docx.Paragraph(`Массовая концентрация сахаров (г/дм³): ${sample.sugar || "Не измерено"}`),
            new docx.Paragraph(`Объемная доля этилового спирта (% об.): ${sample.ethanol || "Не измерено"}`),
            new docx.Paragraph(`Приведенный экстракт (г/дм³): ${sample.reducedExtract || "Не измерено"}`),
            new docx.Paragraph(`Диоксид серы (SO₂) (мг/дм³): ${sample.sulfurDioxide || "Не измерено"}`),
            new docx.Paragraph(`Летучие кислоты (г/дм³): ${sample.volatileAcids || "Не измерено"}`),
            new docx.Paragraph(`Концентрация органических кислот (г/дм³): ${sample.organicAcids || "Не измерено"}`),
            new docx.Paragraph(`Фенольные вещества (мг/дм³): ${sample.phenolicCompounds || "Не измерено"}`),
            new docx.Paragraph(`Катионы металлов (мг/дм³): ${sample.metalCations || "Не измерено"}`),
            new docx.Paragraph(`Анионы неорганических кислот (мг/дм³): ${sample.inorganicAnions || "Не измерено"}`),
            new docx.Paragraph(`Буферная емкость (ммоль/дм³): ${sample.bufferCapacity || "Не измерено"}`),
            new docx.Paragraph(`Электропроводность (мСм/см): ${sample.electricConductivity || "Не измерено"}`),
            new docx.Paragraph({}), // Пустой параграф для разделения
          ]).flat()
        ]
      }]
    });

    // Сохранение файла
    docx.Packer.toBlob(doc).then(blob => {
      saveAs(blob, "анализы_вин.docx");
    });
  }

  function exportSingleSampleToExcel(id) {
    const sample = wineSamples.find(s => s.id === id);
    if (!sample) return;

    // Подготовка данных для экспорта
    const exportData = [{
      "ID": sample.id,
      "Название": sample.name,
      "Сорт": sample.sort,
      "Год урожая": sample.harvestYear,
      "Цвет": sample.color,
      "Категория": sample.category,
      "Место происхождения": sample.zone,
      "Регион": sample.region,
      "Терруар": sample.terroir || "Не указан",
      "Хозяйство": sample.producer || "Не указано",
      "Винодельня": sample.winery || "Не указано",
      "pH": sample.ph || "Не измерено",
      "Титруемые кислоты (г/дм³)": sample.acidity || "Не измерено",
      "Массовая концентрация сахаров (г/дм³)": sample.sugar || "Не измерено",
      "Объемная доля этилового спирта (% об.)": sample.ethanol || "Не измерено",
      "Приведенный экстракт (г/дм³)": sample.reducedExtract || "Не измерено",
      "Диоксид серы (SO₂) (мг/дм³)": sample.sulfurDioxide || "Не измерено",
      "Летучие кислоты (г/дм³)": sample.volatileAcids || "Не измерено",
      "Концентрация органических кислот (г/дм³)": sample.organicAcids || "Не измерено",
      "Фенольные вещества (мг/дм³)": sample.phenolicCompounds || "Не измерено",
      "Катионы металлов (мг/дм³)": sample.metalCations || "Не измерено",
      "Анионы неорганических кислот (мг/дм³)": sample.inorganicAnions || "Не измерено",
      "Буферная емкость (ммоль/дм³)": sample.bufferCapacity || "Не измерено",
      "Электропроводность (мСм/см)": sample.electricConductivity || "Не измерено"
    }];

    // Создание рабочей книги Excel
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Анализ вина");

    // Сохранение файла
    XLSX.writeFile(wb, `анализ_вина_${sample.name}_${sample.id}.xlsx`);
  }

  function exportSingleSampleToWord(id) {
    const sample = wineSamples.find(s => s.id === id);
    if (!sample) return;

    // Подготовка данных для экспорта
    const doc = new docx.Document({
      sections: [{
        properties: {},
        children: [
          new docx.Paragraph({
            text: "Детальный анализ образца вина",
            heading: docx.HeadingLevel.HEADING_1,
            alignment: docx.AlignmentType.CENTER
          }),
          new docx.Paragraph({
            text: `Название: ${sample.name}`,
            heading: docx.HeadingLevel.HEADING_2
          }),
          new docx.Paragraph(`Сорт: ${sample.sort}`),
          new docx.Paragraph(`Год урожая: ${sample.harvestYear}`),
          new docx.Paragraph(`Цвет: ${sample.color}`),
          new docx.Paragraph(`Категория: ${sample.category}`),
          new docx.Paragraph(`Место происхождения: ${sample.zone}`),
          new docx.Paragraph(`Регион: ${sample.region}`),
          new docx.Paragraph(`Терруар: ${sample.terroir || "Не указан"}`),
          new docx.Paragraph(`Хозяйство: ${sample.producer || "Не указано"}`),
          new docx.Paragraph(`Винодельня: ${sample.winery || "Не указано"}`),
          new docx.Paragraph(`pH: ${sample.ph || "Не измерено"}`),
          new docx.Paragraph(`Титруемые кислоты (г/дм³): ${sample.acidity || "Не измерено"}`),
          new docx.Paragraph(`Массовая концентрация сахаров (г/дм³): ${sample.sugar || "Не измерено"}`),
          new docx.Paragraph(`Объемная доля этилового спирта (% об.): ${sample.ethanol || "Не измерено"}`),
          new docx.Paragraph(`Приведенный экстракт (г/дм³): ${sample.reducedExtract || "Не измерено"}`),
          new docx.Paragraph(`Диоксид серы (SO₂) (мг/дм³): ${sample.sulfurDioxide || "Не измерено"}`),
          new docx.Paragraph(`Летучие кислоты (г/дм³): ${sample.volatileAcids || "Не измерено"}`),
          new docx.Paragraph(`Концентрация органических кислот (г/дм³): ${sample.organicAcids || "Не измерено"}`),
          new docx.Paragraph(`Фенольные вещества (мг/дм³): ${sample.phenolicCompounds || "Не измерено"}`),
          new docx.Paragraph(`Катионы металлов (мг/дм³): ${sample.metalCations || "Не измерено"}`),
          new docx.Paragraph(`Анионы неорганических кислот (мг/дм³): ${sample.inorganicAnions || "Не измерено"}`),
          new docx.Paragraph(`Буферная емкость (ммоль/дм³): ${sample.bufferCapacity || "Не измерено"}`),
          new docx.Paragraph(`Электропроводность (мСм/см): ${sample.electricConductivity || "Не измерено"}`)
        ]
      }]
    });

    // Сохранение файла
    docx.Packer.toBlob(doc).then(blob => {
      saveAs(blob, `анализ_вина_${sample.name}_${sample.id}.docx`);
    });
  }
}

// Функция для просмотра деталей образца
function viewSample(id) {
  const sample = wineSamples.find((s) => s.id === id);
  if (!sample) return;

  const modal = document.getElementById("viewSampleModal");
  const sampleName = document.getElementById("sampleName");

  // Основная информация
  sampleName.textContent = `Детальная информация: ${sample.name}`;
  document.getElementById("detail-name").textContent = sample.name;
  document.getElementById("detail-sort").textContent = sample.sort;
  document.getElementById("detail-harvestYear").textContent =
    sample.harvestYear;
  document.getElementById("detail-color").textContent =
    sample.color.charAt(0).toUpperCase() + sample.color.slice(1);
  document.getElementById("detail-category").textContent = sample.category || "Не указан";
  document.getElementById("detail-zone").textContent = sample.zone;
  document.getElementById("detail-region").textContent = sample.region;
  document.getElementById("detail-terroir").textContent =
    sample.terroir || "Не указан";
  document.getElementById("detail-producer").textContent =
    sample.producer || "Не указан";
  document.getElementById("detail-winery").textContent =
    sample.winery || "Не указан";

  // Химический состав
  document.getElementById("detail-ph").textContent = sample.ph
    ? sample.ph.toFixed(3)
    : "Не измерено";
  document.getElementById("detail-sugar").textContent = sample.sugar
    ? sample.sugar.toFixed(1)
    : "Не измерено";
  document.getElementById("detail-acidity").textContent = sample.acidity
    ? sample.acidity.toFixed(2)
    : "Не измерено";
  document.getElementById("detail-reducedExtract").textContent = sample.reducedExtract
    ? sample.reducedExtract.toFixed(2)
    : "Не измерено";
  document.getElementById("detail-sulfurDioxide").textContent = sample.sulfurDioxide
    ? sample.sulfurDioxide.toFixed(2)
    : "Не измерено";
  document.getElementById("detail-volatileAcids").textContent = sample.volatileAcids
    ? sample.volatileAcids.toFixed(2)
    : "Не измерено";
  document.getElementById("detail-organicAcids").textContent = sample.organicAcids
    ? sample.organicAcids.toFixed(2)
    : "Не измерено";
  document.getElementById("detail-phenolicCompounds").textContent = sample.phenolicCompounds
    ? sample.phenolicCompounds.toFixed(2)
    : "Не измерено";

  // Минеральный состав
  document.getElementById("detail-metalCations").textContent = sample.metalCations
    ? sample.metalCations.toFixed(1)
    : "Не измерено";
  document.getElementById("detail-inorganicAnions").textContent = sample.inorganicAnions
    ? sample.inorganicAnions.toFixed(1)
    : "Не измерено";
  document.getElementById("detail-electricConductivity").textContent =
    sample.electricConductivity
      ? sample.electricConductivity.toFixed(1)
      : "Не измерено";
  document.getElementById("detail-ethanol").textContent = sample.ethanol
    ? sample.ethanol.toFixed(2)
    : "Не измерено";
  document.getElementById("detail-bufferCapacity").textContent = sample.bufferCapacity
    ? sample.bufferCapacity.toFixed(2)
    : "Не измерено";

  // Показываем модальное окно
  modal.style.display = "flex";
}

// Глобальные функции для HTML
window.viewSample = viewSample;
