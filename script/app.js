/* =============================================
   app.js — Weekly Meal Planner
   
   APIs used:
     USDA FoodData Central (free, no key needed)
     https://fdc.nal.usda.gov
   
   How it works:
     1. loadPlan()       → loads saved data from localStorage on startup
     2. buildWeekGrid()  → draws the 5-day table into #app
     3. openModal()      → opens search popup when + is clicked
     4. searchFood()     → calls the API and shows results
     5. addFoodToMeal()  → adds chosen food to the right day/meal
     6. savePlan()       → saves the whole plan to localStorage
     7. rerenderDay()    → re-draws a day column with updated data
     8. calcDayTotals()  → sums up nutrition for the whole day
   ============================================= */


// ─────────────────────────────────────────────
//  DATA — 5 days, 3 meals each, food arrays
// ─────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const MEALS = ['Breakfast', 'Lunch', 'Dinner'];

const MEAL_ICONS = {
  'Breakfast': '🌅',
  'Lunch':     '☀️',
  'Dinner':    '🌙',
};

// This is where all added foods are stored.
// Structure: plan[dayIndex][mealName] = [ {name, kcal, protein, carbs, fat, amount}, ... ]
const plan = {};

// Initialise empty arrays for every day and meal first
DAYS.forEach((_, di) => {
  plan[di] = {};
  MEALS.forEach(meal => {
    plan[di][meal] = [];
  });
});

// ─────────────────────────────────────────────
//  LOCALSTORAGE — save and load the meal plan
//  This means data survives a page reload.
//  The plan is saved as JSON under the key 'weeklyMealPlan'.
// ─────────────────────────────────────────────

function savePlan() {
  // Convert the plan object to a JSON string and store it
  localStorage.setItem('weeklyMealPlan', JSON.stringify(plan));
}

function loadPlan() {
  const saved = localStorage.getItem('weeklyMealPlan');

  // If nothing saved yet, just keep the empty arrays we set up above
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);

    // Copy saved foods back into the plan, day by day, meal by meal
    DAYS.forEach((_, di) => {
      MEALS.forEach(meal => {
        if (parsed[di] && Array.isArray(parsed[di][meal])) {
          plan[di][meal] = parsed[di][meal];
        }
      });
    });
  } catch (e) {
    // If saved data is corrupted, just start fresh
    console.warn('Could not load saved plan:', e);
  }
}



// Modal state — which day/meal is currently being edited
let currentDay  = null;
let currentMeal = null;



// ─────────────────────────────────────────────
//  BUILD THE WEEK GRID INTO #app
// ─────────────────────────────────────────────

function buildWeekGrid() {
  const app = document.getElementById('app');

  // Create the week grid container
  const grid = document.createElement('div');
  grid.className = 'week-grid';
  grid.id = 'week-grid';

  // Create one column per day
  DAYS.forEach((day, dayIndex) => {
    const col = buildDayColumn(day, dayIndex);
    grid.appendChild(col);
  });

  app.appendChild(grid);
}

// Builds a full day column element
function buildDayColumn(dayName, dayIndex) {
  const col = document.createElement('div');
  col.className = 'day-column';
  col.id = 'day-col-' + dayIndex;

  // Day header
  const header = document.createElement('div');
  header.className = 'day-header';
  header.innerHTML = `
    <div class="day-name">${dayName}</div>
    <div class="day-date">${getDayDate(dayIndex)}</div>
  `;
  col.appendChild(header);

  // Meal sections
  MEALS.forEach(meal => {
    const section = buildMealSection(dayIndex, meal);
    col.appendChild(section);
  });

  // Day nutrition totals at the bottom
  const totals = buildDayTotals(dayIndex);
  col.appendChild(totals);

  return col;
}

// Builds one meal section (e.g. Breakfast) inside a day
function buildMealSection(dayIndex, meal) {
  const section = document.createElement('div');
  section.className = 'meal-section';
  section.id = `meal-${dayIndex}-${meal}`;

  // Meal label row
  const label = document.createElement('div');
  label.className = 'meal-label';
  label.textContent = MEAL_ICONS[meal] + ' ' + meal;
  section.appendChild(label);

  // Food items already in this slot
  const foods = plan[dayIndex][meal];
  foods.forEach((food, foodIndex) => {
    const item = buildFoodItem(food, dayIndex, meal, foodIndex);
    section.appendChild(item);
  });

  // Add food button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-food-btn';
  addBtn.textContent = '+ Add Food';
  addBtn.onclick = () => openModal(dayIndex, meal);
  section.appendChild(addBtn);

  return section;
}

// Builds a single food item card with nutrition pills
function buildFoodItem(food, dayIndex, meal, foodIndex) {
  const item = document.createElement('div');
  item.className = 'food-item';

  item.innerHTML = `
    <div class="food-item-top">
      <div class="food-item-name">${food.name} <small style="color:#aaa;font-weight:400;">(${food.amount}g)</small></div>
      <button class="food-item-remove" onclick="removeFood(${dayIndex}, '${meal}', ${foodIndex})">✕</button>
    </div>
    <div class="nutrition-pills">
      <span class="pill pill-kcal">🔥 ${food.kcal} kcal</span>
      <span class="pill pill-protein">💪 ${food.protein}g protein</span>
      <span class="pill pill-carbs">🌾 ${food.carbs}g carbs</span>
      <span class="pill pill-fat">🧴 ${food.fat}g fat</span>
    </div>
  `;

  return item;
}

// Builds the day totals summary bar at the bottom of a day column
function buildDayTotals(dayIndex) {
  const totals = calcDayTotals(dayIndex);

  const div = document.createElement('div');
  div.className = 'day-totals';
  div.id = 'totals-' + dayIndex;

  div.innerHTML = `
    <div class="day-totals-title">📊 Day Total</div>
    <div class="day-totals-grid">
      <div class="total-item"><strong>${totals.kcal}</strong>kcal</div>
      <div class="total-item"><strong>${totals.protein}g</strong>protein</div>
      <div class="total-item"><strong>${totals.carbs}g</strong>carbs</div>
      <div class="total-item"><strong>${totals.fat}g</strong>fat</div>
    </div>
  `;

  return div;
}


// ─────────────────────────────────────────────
//  RE-RENDER a single day column (after add/remove)
// ─────────────────────────────────────────────

function rerenderDay(dayIndex) {
  const col = document.getElementById('day-col-' + dayIndex);
  const newCol = buildDayColumn(DAYS[dayIndex], dayIndex);

  // Replace old column with freshly built one
  col.parentNode.replaceChild(newCol, col);
}


// ─────────────────────────────────────────────
//  ADD & REMOVE FOOD
// ─────────────────────────────────────────────

function addFoodToMeal(food) {
  const amount = parseFloat(document.getElementById('modal-amount').value) || 100;
  const ratio  = amount / 100;

  // Save before closeModal() nulls them
  const dayIndex = currentDay;
  const meal     = currentMeal;

  const item = {
    name:    food.name,
    amount:  amount,
    kcal:    Math.round(food.kcal    * ratio),
    protein: r1(food.protein * ratio),
    carbs:   r1(food.carbs   * ratio),
    fat:     r1(food.fat     * ratio),
  };

  plan[dayIndex][meal].push(item);
  savePlan(); // Save to localStorage so data survives page reload

  closeModal();
  rerenderDay(dayIndex);
}

function removeFood(dayIndex, meal, foodIndex) {
  plan[dayIndex][meal].splice(foodIndex, 1);
  savePlan(); // Save to localStorage after removal
  rerenderDay(dayIndex);
}


// ─────────────────────────────────────────────
//  CALCULATE DAY TOTALS
// ─────────────────────────────────────────────

function calcDayTotals(dayIndex) {
  let kcal = 0, protein = 0, carbs = 0, fat = 0;

  MEALS.forEach(meal => {
    plan[dayIndex][meal].forEach(food => {
      kcal    += food.kcal;
      protein += food.protein;
      carbs   += food.carbs;
      fat     += food.fat;
    });
  });

  return {
    kcal:    Math.round(kcal),
    protein: r1(protein),
    carbs:   r1(carbs),
    fat:     r1(fat),
  };
}


// ─────────────────────────────────────────────
//  MODAL — open / close
// ─────────────────────────────────────────────

function openModal(dayIndex, meal) {
  currentDay  = dayIndex;
  currentMeal = meal;

  const overlay = document.getElementById('modal-overlay');

  // Build modal HTML
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>Add food to ${DAYS[dayIndex]} — ${meal}</h3>
        <button class="modal-close-btn" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">

        <div class="modal-search-row">
          <input type="text" id="modal-search-input" placeholder="Search food (e.g. oats, chicken…)" autocomplete="off" />
          <button onclick="searchFood()">Search</button>
        </div>

        <div class="modal-amount-row">
          <label for="modal-amount">Amount:</label>
          <input type="number" id="modal-amount" value="100" min="1" />
          <span>grams</span>
        </div>

        <div class="modal-status" id="modal-status"></div>

        <div id="modal-results"></div>

      </div>
    </div>
  `;

  overlay.classList.add('open');

  // Focus the search input
  document.getElementById('modal-search-input').focus();

  // Allow pressing Enter to search
  document.getElementById('modal-search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') searchFood();
  });
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('open');
  overlay.innerHTML = '';
  currentDay  = null;
  currentMeal = null;
}

// Close modal if user clicks the dark background (not the modal box itself)
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// Stop clicks inside modal-box from bubbling up to overlay
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target.closest('.modal-box')) e.stopPropagation();
});


// ─────────────────────────────────────────────
//  FOOD SEARCH  — USDA FoodData Central API
//  Official US government food database.
//  Covers all whole foods: apple, banana, milk, chicken etc.
//  DEMO_KEY is built-in and works immediately.
// ─────────────────────────────────────────────

async function searchFood() {
  const input = document.getElementById('modal-search-input');
  const query = input.value.trim();

  if (!query) {
    showModalStatus('Please type a food name to search.', 'error');
    return;
  }

  const resultsDiv = document.getElementById('modal-results');
  resultsDiv.innerHTML = `<div style="padding:16px;text-align:center;color:#888;font-size:0.85rem"><span class="spinner"></span>Searching…</div>`;
  showModalStatus('', '');

  try {
    // USDA FoodData Central — free government API, no key needed (DEMO_KEY is built in)
    // dataType SR Legacy + Foundation covers all raw whole foods perfectly
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search` +
                `?api_key=4gYCEJf8GF4Z3APLH1QkMJUDRwSivModMlB1Rfxh` +
                `&query=${encodeURIComponent(query)}` +
                `&dataType=SR%20Legacy,Foundation` +
                `&pageSize=10`;

    const response = await fetch(url);

    if (response.status === 429) {
      resultsDiv.innerHTML = '';
      showModalStatus('Too many searches. Please wait a moment and try again.', 'error');
      return;
    }

    if (!response.ok) {
      resultsDiv.innerHTML = '';
      showModalStatus('Search failed. Please try again.', 'error');
      return;
    }

    const data = await response.json();
    const foods = data.foods || [];

    if (foods.length === 0) {
      resultsDiv.innerHTML = '';
      showModalStatus(`No results found for "${query}". Try another keyword.`, 'error');
      return;
    }

    // USDA nutrient IDs:
    // 1008 = Energy (kcal), 1003 = Protein, 1005 = Carbohydrates, 1004 = Total fat
    const results = foods.map(food => {
      const get = (id) => {
        const n = (food.foodNutrients || []).find(n => n.nutrientId === id);
        return n ? parseFloat(n.value) || 0 : 0;
      };
      return {
        name:    food.description,
        kcal:    Math.round(get(1008)),
        protein: r1(get(1003)),
        carbs:   r1(get(1005)),
        fat:     r1(get(1004)),
      };
    });

    renderSearchResults(results);

  } catch (err) {
    resultsDiv.innerHTML = '';
    showModalStatus('Could not reach the food database. Please check your internet connection.', 'error');
    console.error('USDA API error:', err);
  }
}

// Draw the list of search results inside the modal
function renderSearchResults(foods) {
  const resultsDiv = document.getElementById('modal-results');
  resultsDiv.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'search-results-list';

  foods.forEach(food => {
    const item = document.createElement('div');
    item.className = 'search-result-item';

    item.innerHTML = `
      <div class="result-name">${food.name}</div>
      <div class="result-macros">
        🔥 ${food.kcal} kcal &nbsp;|&nbsp;
        💪 ${food.protein}g protein &nbsp;|&nbsp;
        🌾 ${food.carbs}g carbs &nbsp;|&nbsp;
        🧴 ${food.fat}g fat
        <em style="color:#bbb;">(per 100g)</em>
      </div>
    `;

    // When clicked, add this food to the current day/meal
    item.addEventListener('click', () => addFoodToMeal(food));

    list.appendChild(item);
  });

  resultsDiv.appendChild(list);
}

// Show a status/info message inside the modal
function showModalStatus(msg, type) {
  const el = document.getElementById('modal-status');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'modal-status' + (type ? ' ' + type : '');
}


// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

// Round to 1 decimal place
function r1(n) {
  return Math.round(n * 10) / 10;
}

// Get a date string for each weekday starting from this Monday
function getDayDate(dayIndex) {
  const today  = new Date();
  const monday = new Date(today);
  // Find this week's Monday
  const diff   = today.getDay() === 0 ? -6 : 1 - today.getDay();
  monday.setDate(today.getDate() + diff + dayIndex);
  return monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}


// ─────────────────────────────────────────────
//  START — load saved data then build the app
// ─────────────────────────────────────────────

loadPlan();     // Step 1: restore any previously saved meals from localStorage
buildWeekGrid(); // Step 2: draw the grid (it will include the loaded foods)
