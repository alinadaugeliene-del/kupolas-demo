/* ==========================================================
   KUPOLAS — laisvų datų kalendorius su kainos skaičiavimu (demo)
   Užimtumas sugeneruotas; tikroje svetainėje jį duotų rezervacijų sistema.
   ========================================================== */
(function () {
  var root = document.querySelector('[data-booking]');
  if (!root) return;

  var DOMES = {
    'Samanos':  { week: 180, weekend: 210, guests: 2 },
    'Pušis':    { week: 220, weekend: 250, guests: 2 },
    'Žvaigždė': { week: 260, weekend: 290, guests: 2 },
    'Giria':    { week: 240, weekend: 270, guests: 4 }
  };
  var MONTHS = ['sausis', 'vasaris', 'kovas', 'balandis', 'gegužė', 'birželis', 'liepa', 'rugpjūtis', 'rugsėjis', 'spalis', 'lapkritis', 'gruodis'];
  var MONTHS_GEN = ['sausio', 'vasario', 'kovo', 'balandžio', 'gegužės', 'birželio', 'liepos', 'rugpjūčio', 'rugsėjo', 'spalio', 'lapkričio', 'gruodžio'];

  var form = document.querySelector('form.form');
  var elMonths = root.querySelector('.cal__months');
  var elDomes = root.querySelector('.cal__domes');
  var prevBtn = root.querySelector('[data-prev]');
  var nextBtn = root.querySelector('[data-next]');
  var sum = document.querySelector('.summary');

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var view = new Date(today.getFullYear(), today.getMonth(), 1);
  var dome = (form && form.kupolas && DOMES[form.kupolas.value]) ? form.kupolas.value : 'Žvaigždė';
  var start = null, end = null;

  function key(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function isWeekendNight(d) { var w = d.getDay(); return w === 5 || w === 6; } // penktadienio ir šeštadienio naktys
  function price(d) { return isWeekendNight(d) ? DOMES[dome].weekend : DOMES[dome].week; }
  function fmt(d) { return d.getDate() + ' ' + MONTHS_GEN[d.getMonth()]; }

  // pseudo-atsitiktinis, bet pastovus užimtumas
  function booked(d) {
    if (d < today) return true;
    var s = key(d) + dome, h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    var r = (h % 1000) / 1000;
    var soon = (d - today) / 864e5 < 21;
    return r < (isWeekendNight(d) ? (soon ? 0.7 : 0.4) : (soon ? 0.3 : 0.14));
  }

  function rangeFree(a, b) { for (var d = new Date(a); d < b; d = addDays(d, 1)) if (booked(d)) return false; return true; }

  function renderDomes() {
    elDomes.innerHTML = '';
    Object.keys(DOMES).forEach(function (name) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cal__dome' + (name === dome ? ' is-active' : ''); b.textContent = name;
      b.addEventListener('click', function () { dome = name; if (form && form.kupolas) form.kupolas.value = name; if (start && end && !rangeFree(start, end)) { start = end = null; } render(); });
      elDomes.appendChild(b);
    });
  }

  function renderMonth(base) {
    var wrap = document.createElement('div'); wrap.className = 'cal__month';
    var t = document.createElement('div'); t.className = 'cal__title'; t.textContent = MONTHS[base.getMonth()] + ' ' + base.getFullYear(); wrap.appendChild(t);
    var g = document.createElement('div'); g.className = 'cal__grid';
    ['Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št', 'Sk'].forEach(function (w) { var e = document.createElement('div'); e.className = 'cal__wd'; e.textContent = w; g.appendChild(e); });
    var offset = (base.getDay() + 6) % 7;
    for (var i = 0; i < offset; i++) g.appendChild(document.createElement('span'));
    var days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    for (var dn = 1; dn <= days; dn++) {
      var d = new Date(base.getFullYear(), base.getMonth(), dn);
      var b = document.createElement('button'); b.type = 'button'; b.className = 'cal__day';
      var nightBooked = booked(d);
      // išvykimo diena gali būti užimta naktis, jei renkamės pabaigą
      var canBeEnd = start && !end && d > start && rangeFree(start, d);
      b.disabled = nightBooked && !canBeEnd;
      b.innerHTML = dn + '<small>' + (nightBooked ? '' : price(d) + ' €') + '</small>';
      if (start && key(d) === key(start)) b.classList.add('is-start');
      if (end && key(d) === key(end)) b.classList.add('is-end');
      if (start && end && d > start && d < end) b.classList.add('is-in');
      b.dataset.date = key(d);
      b.setAttribute('aria-label', fmt(d) + (nightBooked ? ', užimta' : ', ' + price(d) + ' €'));
      g.appendChild(b);
    }
    wrap.appendChild(g);
    return wrap;
  }

  function pick(d) {
    if (!start || end || d <= start) { start = d; end = null; }
    else if (rangeFree(start, d)) { end = d; }
    else { start = d; end = null; }
    render();
  }

  function render() {
    renderDomes();
    elMonths.innerHTML = '';
    elMonths.appendChild(renderMonth(view));
    elMonths.appendChild(renderMonth(new Date(view.getFullYear(), view.getMonth() + 1, 1)));
    prevBtn.disabled = view <= new Date(today.getFullYear(), today.getMonth(), 1);
    renderSummary();
    syncForm();
  }

  function renderSummary() {
    if (!sum) return;
    var title = sum.querySelector('h3'), dates = sum.querySelector('.summary__dates'), rows = sum.querySelector('.summary__rows');
    var total = sum.querySelector('.summary__total b'), note = sum.querySelector('.summary__note'), btn = sum.querySelector('.btn');
    title.textContent = '„' + dome + '“';
    rows.innerHTML = ''; note.classList.remove('summary__warn');
    if (!start) { dates.textContent = 'Pasirinkite atvykimo dieną kalendoriuje'; total.textContent = '—'; note.textContent = 'Kainos — už kupolą, ne už asmenį.'; btn.classList.add('is-disabled'); return; }
    if (!end) { dates.textContent = 'Atvykimas ' + fmt(start) + ' · pasirinkite išvykimo dieną'; total.textContent = '—'; note.textContent = ''; btn.classList.add('is-disabled'); return; }
    var nights = Math.round((end - start) / 864e5), week = 0, wk = 0, weekendNights = 0;
    for (var d = new Date(start); d < end; d = addDays(d, 1)) { if (isWeekendNight(d)) { wk += price(d); weekendNights++; } else week += price(d); }
    dates.textContent = fmt(start) + ' – ' + fmt(end) + ' · ' + nights + (nights === 1 ? ' naktis' : (nights < 10 ? ' naktys' : ' naktų'));
    if (week) rows.innerHTML += '<div><span>Darbo dienų naktys × ' + (nights - weekendNights) + '</span><span>' + week + ' €</span></div>';
    if (wk) rows.innerHTML += '<div><span>Savaitgalio naktys × ' + weekendNights + '</span><span>' + wk + ' €</span></div>';
    rows.innerHTML += '<div><span>Pusryčiai, malkos, chalatai</span><span>įskaičiuota</span></div>';
    var sumTotal = week + wk;
    var discount = nights >= 3 ? Math.round(sumTotal * 0.1) : 0;
    if (discount) rows.innerHTML += '<div><span>−10 % nuo 3 naktų</span><span>−' + discount + ' €</span></div>';
    total.textContent = (sumTotal - discount) + ' €';
    if (weekendNights && nights < 2) { note.textContent = 'Savaitgaliais — mažiausiai 2 naktys. Pasirinkite vėlesnę išvykimo dieną.'; note.classList.add('summary__warn'); btn.classList.add('is-disabled'); }
    else { note.textContent = 'Mokėti dabar nereikia — patvirtinsime datas ir atsiųsime apmokėjimo nuorodą.'; btn.classList.remove('is-disabled'); }
  }

  function syncForm() {
    if (!form) return;
    if (form.atvykimas) form.atvykimas.value = start ? key(start) : '';
    if (form.isvykimas) form.isvykimas.value = end ? key(end) : '';
  }

  elMonths.addEventListener('click', function (e) {
    var b = e.target.closest('.cal__day');
    if (!b || b.disabled) return;
    var p = b.dataset.date.split('-');
    pick(new Date(+p[0], +p[1] - 1, +p[2]));
  });
  prevBtn.addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); });
  nextBtn.addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); });

  if (form && form.kupolas) form.kupolas.addEventListener('change', function () { if (DOMES[form.kupolas.value]) { dome = form.kupolas.value; start = end = null; render(); } });
  if (sum) sum.querySelector('.btn').addEventListener('click', function (e) {
    e.preventDefault();
    if (this.classList.contains('is-disabled')) return;
    var f = document.getElementById('uzklausa');
    if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(function () { form.vardas && form.vardas.focus({ preventScroll: true }); }, 700); }
  });

  render();
})();
