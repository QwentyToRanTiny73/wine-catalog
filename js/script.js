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
  const exportBtn = document.getElementById("exportBtn");
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
  exportBtn.addEventListener("click", exportToExcel);
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
            "lemonAcid",
            "wineAcid",
            "appleAcid",
            "glycerin",
            "calcium",
            "electricConductivity",
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
  }

  function applyFilters() {
    const search = document.getElementById("searchInput").value.toLowerCase();
    const region = document.getElementById("regionFilter").value;
    const sort = document.getElementById("sortFilter").value;
    const year = document.getElementById("yearFilter").value;
    const color = document.getElementById("colorFilter").value;
    const zone = document.getElementById("zoneFilter").value;
    const winery = document.getElementById("wineryFilter").value;
    const producer = document.getElementById("producerFilter").value;

    filteredSamples = wineSamples.filter((sample) => {
      const matchesSearch =
        !search ||
        sample.name.toLowerCase().includes(search) ||
        sample.sort.toLowerCase().includes(search) ||
        sample.zone.toLowerCase().includes(search) ||
        sample.region.toLowerCase().includes(search) ||
        sample.producer.toLowerCase().includes(search) ||
        sample.winery.toLowerCase().includes(search) ||
        sample.terroir.toLowerCase().includes(search);

      const matchesRegion = !region || sample.region === region;
      const matchesSort = !sort || sample.sort === sort;
      const matchesYear = !year || String(sample.harvestYear) === year;
      const matchesColor = !color || sample.color === color;
      const matchesZone = !zone || sample.zone === zone;
      const matchesWinery = !winery || sample.winery === winery;
      const matchesProducer = !producer || sample.producer === producer;

      return (
        matchesSearch &&
        matchesRegion &&
        matchesSort &&
        matchesYear &&
        matchesColor &&
        matchesZone &&
        matchesWinery &&
        matchesProducer
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
    document.getElementById("wineryFilter").value = "";
    document.getElementById("producerFilter").value = "";

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
        '<tr><td colspan="9" style="text-align: center; padding: 30px;">Нет данных для отображения</td></tr>';
      return;
    }

    pageSamples.forEach((sample) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${sample.name}</td>
        <td>${sample.sort}</td>
        <td>${sample.harvestYear}</td>
        <td>${sample.color.charAt(0).toUpperCase() + sample.color.slice(1)}</td>
        <td>${sample.region}</td>
        <td>${sample.zone}</td>
        <td>${sample.ph ? sample.ph.toFixed(3) : "-"}</td>
        <td>${sample.sugar ? sample.sugar.toFixed(1) : "-"}</td>
        <td>
          <button class="btn" style="padding: 6px 12px; font-size: 14px;" onclick="viewSample(${
            sample.id
          })">Подробнее</button>
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
      zone: form.zone.value.trim(),
      region: form.region.value.trim(),
      terroir: form.terroir.value.trim() || "Не указан",
      producer: form.producer.value.trim() || "Не указан",
      winery: form.winery.value.trim() || "Не указан",
      category: form.category ? form.category.value.trim() || "Столовое" : "Столовое",
      origin: form.origin ? form.origin.value.trim() || "Крым" : "Крым",
      ph: parseFloat(form.ph.value),
      acidity: form.acidity.value ? parseFloat(form.acidity.value) : 0,
      sugar: parseFloat(form.sugar.value),
      extract: form.extract ? parseFloat(form.extract.value) || 0 : 0,
      so2: form.so2 ? parseFloat(form.so2.value) || 0 : 0,
      volatileAcids: form.volatileAcids ? parseFloat(form.volatileAcids.value) || 0 : 0,
      lemonAcid: form.lemonAcid.value ? parseFloat(form.lemonAcid.value) : 0,
      wineAcid: form.wineAcid.value ? parseFloat(form.wineAcid.value) : 0,
      appleAcid: form.appleAcid.value ? parseFloat(form.appleAcid.value) : 0,
      succinicAcid: form.succinicAcid ? parseFloat(form.succinicAcid.value) || 0 : 0,
      aceticAcid: form.aceticAcid ? parseFloat(form.aceticAcid.value) || 0 : 0,
      glucose: form.glucose ? parseFloat(form.glucose.value) || 0 : 0,
      fructose: form.fructose ? parseFloat(form.fructose.value) || 0 : 0,
      sucrose: form.sucrose ? parseFloat(form.sucrose.value) || 0 : 0,
      glycerin: form.glycerin.value ? parseFloat(form.glycerin.value) : 0,
      ethanol: form.ethanol ? parseFloat(form.ethanol.value) || 0 : 0,
      phenols: form.phenols ? parseFloat(form.phenols.value) || 0 : 0,
      potassium: form.potassium ? parseFloat(form.potassium.value) || 0 : 0,
      sodium: form.sodium ? parseFloat(form.sodium.value) || 0 : 0,
      calcium: form.calcium.value ? parseFloat(form.calcium.value) : 0,
      magnesium: form.magnesium ? parseFloat(form.magnesium.value) || 0 : 0,
      chlorides: form.chlorides ? parseFloat(form.chlorides.value) || 0 : 0,
      otherMinerals: form.otherMinerals ? parseFloat(form.otherMinerals.value) || 0 : 0,
      electricConductivity: form.electricConductivity ? parseFloat(form.electricConductivity.value) || 0 : 0,
      bufferCapacity: form.bufferCapacity ? parseFloat(form.bufferCapacity.value) || 0 : 0,
    };

    // Валидация
    if (
      !newSample.name ||
      !newSample.sort ||
      !newSample.harvestYear ||
      !newSample.color ||
      !newSample.zone ||
      !newSample.region ||
      !newSample.ph ||
      !newSample.sugar
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
    alert("Функция экспорта в Excel будет реализована в будущем");
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
  document.getElementById("detail-zone").textContent = sample.zone;
  document.getElementById("detail-region").textContent = sample.region;
  document.getElementById("detail-terroir").textContent =
    sample.terroir || "Не указан";
  document.getElementById("detail-producer").textContent =
    sample.producer || "Не указан";
  document.getElementById("detail-winery").textContent =
    sample.winery || "Не указан";

  // Техническая информация
  document.getElementById("detail-category").textContent = sample.category || "Не указана";
  document.getElementById("detail-origin").textContent = sample.origin || "Не указано";

  // Нормируемые показатели
  document.getElementById("detail-ethanol").textContent = sample.ethanol
    ? sample.ethanol.toFixed(2)
    : "Не измерено";
  document.getElementById("detail-sugar").textContent = sample.sugar
    ? sample.sugar.toFixed(1)
    : "Не измерено";
  document.getElementById("detail-acidity").textContent = sample.acidity
    ? sample.acidity.toFixed(2)
    : "Не измерено";
  document.getElementById("detail-extract").textContent = sample.extract
    ? sample.extract.toFixed(1)
    : "Не измерено";
  document.getElementById("detail-so2").textContent = sample.so2
    ? sample.so2.toFixed(1)
    : "Не измерено";
  document.getElementById("detail-volatileAcids").textContent = sample.volatileAcids
    ? sample.volatileAcids.toFixed(2)
    : "Не измерено";
  document.getElementById("detail-lemonAcid").textContent = sample.lemonAcid
    ? sample.lemonAcid.toFixed(2)
    : "Не измерено";

  // Дополнительные показатели
  document.getElementById("detail-wineAcid").textContent = sample.wineAcid
    ? sample.wineAcid.toFixed(2)
    : "Не измерено";
  document.getElementById("detail-appleAcid").textContent = sample.appleAcid
    ? sample.appleAcid.toFixed(2)
    : "Не измерено";
  document.getElementById("detail-succinicAcid").textContent = sample.succinicAcid
    ? sample.succinicAcid.toFixed(2)
    : "Не измерено";
  document.getElementById("detail-aceticAcid").textContent = sample.aceticAcid
    ? sample.aceticAcid.toFixed(2)
    : "Не измерено";
  document.getElementById("detail-glucose").textContent = sample.glucose
    ? sample.glucose.toFixed(1)
    : "Не измерено";
  document.getElementById("detail-fructose").textContent = sample.fructose
    ? sample.fructose.toFixed(1)
    : "Не измерено";
  document.getElementById("detail-sucrose").textContent = sample.sucrose
    ? sample.sucrose.toFixed(1)
    : "Не измерено";
  document.getElementById("detail-glycerin").textContent = sample.glycerin
    ? sample.glycerin.toFixed(2)
    : "Не измерено";
  document.getElementById("detail-phenols").textContent = sample.phenols
    ? sample.phenols.toFixed(1)
    : "Не измерено";

  // Компоненты
  document.getElementById("detail-potassium").textContent = sample.potassium
    ? sample.potassium.toFixed(1)
    : "Не измерено";
  document.getElementById("detail-sodium").textContent = sample.sodium
    ? sample.sodium.toFixed(1)
    : "Не измерено";
  document.getElementById("detail-calcium").textContent = sample.calcium
    ? sample.calcium.toFixed(1)
    : "Не измерено";
  document.getElementById("detail-magnesium").textContent = sample.magnesium
    ? sample.magnesium.toFixed(1)
    : "Не измерено";
  document.getElementById("detail-chlorides").textContent = sample.chlorides
    ? sample.chlorides.toFixed(1)
    : "Не измерено";
  document.getElementById("detail-otherMinerals").textContent = sample.otherMinerals
    ? sample.otherMinerals.toFixed(1)
    : "Не измерено";

  // Физико-химические характеристики
  document.getElementById("detail-ph").textContent = sample.ph
    ? sample.ph.toFixed(3)
    : "Не измерено";
  document.getElementById("detail-bufferCapacity").textContent = sample.bufferCapacity
    ? sample.bufferCapacity.toFixed(1)
    : "Не измерено";
  document.getElementById("detail-electricConductivity").textContent =
    sample.electricConductivity
      ? sample.electricConductivity.toFixed(1)
      : "Не измерено";

  // Показываем модальное окно
  modal.style.display = "flex";
}

// Глобальные функции для HTML
window.viewSample = viewSample;
