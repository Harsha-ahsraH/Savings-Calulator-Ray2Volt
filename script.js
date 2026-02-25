// Function to format currency (returns only formatted string)
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return "N/A";
    const numValue = Number(value);
    const options = { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 };
    let formatted = new Intl.NumberFormat('en-IN', options).format(numValue);
    return formatted.replace('₹', '₹ ');
}

// Function to format numbers
function formatNumber(value, decimalPlaces = 2, unit = '') {
    if (value === null || value === undefined || isNaN(value)) return "N/A";
    const numValue = Number(value);
    const options = { minimumFractionDigits: 0, maximumFractionDigits: decimalPlaces };
    if (unit.toLowerCase().includes('year') && Number.isInteger(numValue)) {
        options.maximumFractionDigits = 0;
    } else if (!Number.isInteger(numValue) && decimalPlaces > 0) {
        const actualDecimals = (numValue.toString().split('.')[1] || '').length;
        options.minimumFractionDigits = Math.min(1, decimalPlaces, actualDecimals);
        options.maximumFractionDigits = Math.min(decimalPlaces, actualDecimals);
    } else if (Number.isInteger(numValue) && decimalPlaces === 0) {
        options.maximumFractionDigits = 0;
    }
    let formatted = numValue.toLocaleString('en-IN', options);
    return unit ? `${formatted} ${unit}` : formatted;
}

// Helper function to get color class based on value
function getColorClass(value) {
    if (isNaN(value) || value === null || value === undefined) return ''; // No class if invalid
    return value >= 0 ? 'text-profit' : 'text-loss';
}


// --- Main Calculation Function ---
function calculateSavings() {
    const errorDiv = document.getElementById('errorMessage');
    const resultsSection = document.getElementById('resultsSection');
    const initialMessage = document.getElementById('initialMessage');
    errorDiv.innerText = '';
    errorDiv.style.display = 'none';
    resultsSection.style.display = 'none';
    initialMessage.style.display = 'none';

    // --- 1. Get and Validate Inputs ---
    let inputs = {};
    let errors = [];
    const inputIds = [
        'subsidyAmount', 'downPayment', 'loanTenure',
        'interestRate', 'kwInstalled', 'unitsPerKwDay', 'avgUnitsConsumed',
        'costPerUnit', 'additionalCharges', 'inflationRate', 'netMeteringRate', 'totalCost', 'manualKwInput'
    ];

    // Clear previous error highlights
    inputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('input-error');
    });

    inputIds.forEach(id => {
        const element = document.getElementById(id);
        if (!element) return; // Skip if element doesn't exist (like manualKwInput if not visible)
        const value = (id === 'loanTenure' || id === 'kwInstalled' || id === 'manualKwInput')
            ? parseInt(element.value, 10) // Consider manualKwInput as potentially integer or float later
            : parseFloat(element.value);

        // Allow totalCost and manualKwInput to be potentially empty initially
        if ((id === 'totalCost' || id === 'manualKwInput') && (element.value === '' || element.value === null)) {
            inputs[id] = NaN;
        } else if (id === 'kwInstalled' && element.value === 'manual') {
            inputs[id] = 'manual'; // Store 'manual' string to signify manual mode
            document.getElementById('manualKwInputGroup').style.display = 'block';
        } else if (id === 'kwInstalled' && element.value !== 'manual') {
            document.getElementById('manualKwInputGroup').style.display = 'none';
            inputs['manualKwInput'] = NaN; // Clear manual input if a fixed kW is chosen
            if (document.getElementById('manualKwInput')) document.getElementById('manualKwInput').value = '';
            if (isNaN(value) || value <= 0) { // Standard validation for fixed kW
                element.classList.add('input-error');
                errors.push(`Select a valid kW Installed Capacity.`);
                inputs[id] = NaN;
            } else {
                inputs[id] = value;
            }
        } else if (isNaN(value) || (value < 0 && !['interestRate', 'subsidyAmount', 'downPayment', 'inflationRate', 'netMeteringRate'].includes(id))) {
            element.classList.add('input-error');
            let fieldName = element.previousElementSibling.innerText.replace(/[:\d.]/g, '').trim();
            if (id === 'manualKwInput' && (isNaN(value) || value <= 0)) {
                errors.push('Enter a valid Manual System Capacity (kW) > 0.');
            } else if (id === 'kwInstalled' && (isNaN(value) || value <= 0)) { // This should not be hit if 'manual' is selected
                errors.push(`Enter a valid value for ${fieldName}.`);
            }
            inputs[id] = NaN;
        } else {
            inputs[id] = value;
        }
    });

    // Define the kW to Cost mapping
    const kwCostMap = {
        2: 170000,
        3: 218000,
        4: 270000,
        5: 325000,
        6: 380000,
        8: 480000,
        10: 580000
    };

    const totalCostInput = document.getElementById('totalCost');
    let userProvidedTotalCost = parseFloat(totalCostInput.value);

    // Handle kwInstalled logic, including manual entry
    let actualKwInstalled = NaN;
    const kwSelectedOption = document.getElementById('kwInstalled').value;

    if (kwSelectedOption === 'manual') {
        document.getElementById('manualKwInputGroup').style.display = 'block';
        actualKwInstalled = parseFloat(document.getElementById('manualKwInput').value);
        if (isNaN(actualKwInstalled) || actualKwInstalled <= 0) {
            errors.push("Enter a valid Manual System Capacity (kW) > 0.");
            const manKwEl = document.getElementById('manualKwInput');
            if (manKwEl) manKwEl.classList.add('input-error');
        }
        inputs.kwInstalled = actualKwInstalled;
        // For manual kW entry, totalCost is always manual
        if (!isNaN(userProvidedTotalCost) && userProvidedTotalCost > 0) {
            inputs.totalCost = userProvidedTotalCost;
        } else {
            inputs.totalCost = NaN;
            totalCostInput.placeholder = "Enter project cost manually";
        }
        totalCostInput.dataset.previousKw = 'manual';
    } else if (kwSelectedOption && kwSelectedOption !== "") {
        document.getElementById('manualKwInputGroup').style.display = 'none';
        document.getElementById('manualKwInput').value = '';
        actualKwInstalled = parseInt(kwSelectedOption, 10);
        inputs.kwInstalled = actualKwInstalled;

        // Auto-fill logic for totalCost based on fixed kW selection
        if (kwCostMap.hasOwnProperty(actualKwInstalled)) {
            // If no manual cost is provided or it's the first time selecting this kW
            if (isNaN(userProvidedTotalCost) || userProvidedTotalCost <= 0 ||
                totalCostInput.dataset.previousKw !== actualKwInstalled.toString()) {
                totalCostInput.value = kwCostMap[actualKwInstalled];
                inputs.totalCost = kwCostMap[actualKwInstalled];
                userProvidedTotalCost = inputs.totalCost;
            } else {
                // Keep the user's manual cost if they've modified it
                inputs.totalCost = userProvidedTotalCost;
            }
        } else {
            inputs.totalCost = isNaN(userProvidedTotalCost) ? NaN : userProvidedTotalCost;
        }
        totalCostInput.dataset.previousKw = actualKwInstalled.toString();
    } else { // No selection or placeholder selected
        document.getElementById('manualKwInputGroup').style.display = 'none';
        // document.getElementById('manualKwInput').value = ''; // Clear if not manual
        inputs.kwInstalled = NaN;
        if (!errors.some(e => e.includes("kW Installed Capacity"))) {
            errors.push("Select a kW Installed Capacity.");
        }
        if (!isNaN(userProvidedTotalCost)) {
            inputs.totalCost = userProvidedTotalCost;
        } else {
            inputs.totalCost = NaN;
        }
        totalCostInput.dataset.previousKw = '';
    }

    // Re-assign inputs.kwInstalled for calculation with the actual numeric value
    inputs.kwInstalled = actualKwInstalled;

    // Validate totalCost finally
    if (isNaN(inputs.totalCost) || inputs.totalCost <= 0) {
        const tcElement = document.getElementById('totalCost');
        if (tcElement) tcElement.classList.add('input-error');
        if (!errors.some(e => e.includes("Total Project Cost") || e.includes("kW Installed Capacity"))) {
            errors.push("Enter a valid Total Project Cost or select a kW capacity to auto-fill.");
        }
    }


    // Cross-Validations
    if (!isNaN(inputs.subsidyAmount) && !isNaN(inputs.totalCost) && inputs.subsidyAmount > inputs.totalCost) { errors.push("Subsidy cannot exceed Total Cost."); }
    const tempNetCost = inputs.totalCost - inputs.subsidyAmount;
    if (!isNaN(inputs.downPayment) && !isNaN(tempNetCost) && inputs.downPayment > tempNetCost) { errors.push("Down Payment cannot exceed Net Cost."); }
    if (!isNaN(inputs.loanTenure) && inputs.loanTenure <= 0 && (tempNetCost - inputs.downPayment) > 0) { errors.push("Loan Tenure must be > 0 if loan needed."); }

    if (errors.length > 0) {
        errorDiv.innerHTML = errors.join('<br>');
        errorDiv.style.display = 'block';
        resultsSection.style.display = 'none';
        initialMessage.style.display = 'block';
        const resultsTbody = document.getElementById('resultsTable').getElementsByTagName('tbody')[0];
        if (resultsTbody) resultsTbody.innerHTML = '';
        document.getElementById('monthlyCostsComparison').innerHTML = '';
        document.getElementById('breakevenAnalysis').innerHTML = '';
        return;
    }

    // --- 2. Core Calculations (Financial & Annual Energy Balance) ---
    const netProjectCost = Math.max(0, inputs.totalCost - inputs.subsidyAmount);
    const loanAmount = Math.max(0, netProjectCost - inputs.downPayment);
    const additionalCharges = isNaN(inputs.additionalCharges) ? 0 : inputs.additionalCharges;

    let monthlyEMI = 0;
    let totalLoanPaid = 0;
    let actualLoanTenure = inputs.loanTenure;
    const numberOfMonths = actualLoanTenure * 12;

    if (loanAmount > 0 && numberOfMonths > 0) {
        const annualInterestRate = inputs.interestRate;
        if (annualInterestRate > 0) {
            const monthlyInterestRate = annualInterestRate / 12 / 100;
            const powerTerm = Math.pow(1 + monthlyInterestRate, numberOfMonths);
            const emiNumerator = loanAmount * monthlyInterestRate * powerTerm;
            const emiDenominator = powerTerm - 1;
            monthlyEMI = (emiDenominator > 0) ? (emiNumerator / emiDenominator) : (loanAmount / numberOfMonths);
        } else {
            monthlyEMI = loanAmount / numberOfMonths;
        }
        monthlyEMI = isNaN(monthlyEMI) ? 0 : Math.round(monthlyEMI * 100) / 100;

        // Calculate reduced tenure if subsidy is repaid to loan
        if (inputs.subsidyAmount > 0) {
            // Calculate how many months it would take to repay the loan with the same EMI
            // but with reduced principal (after subsidy repayment)
            const reducedPrincipal = loanAmount - inputs.subsidyAmount;
            if (reducedPrincipal > 0) {
                const monthlyInterestRate = annualInterestRate / 12 / 100;
                // Solve for n in EMI formula: EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
                // where P = reducedPrincipal, r = monthlyInterestRate, EMI = monthlyEMI
                let n = 0;
                let left = 0;
                let right = numberOfMonths;
                const tolerance = 0.01; // 1% tolerance for floating point calculations

                while (right - left > tolerance) {
                    n = (left + right) / 2;
                    const powerTerm = Math.pow(1 + monthlyInterestRate, n);
                    const calculatedEMI = reducedPrincipal * monthlyInterestRate * powerTerm / (powerTerm - 1);

                    if (Math.abs(calculatedEMI - monthlyEMI) < tolerance) {
                        break;
                    } else if (calculatedEMI > monthlyEMI) {
                        right = n;
                    } else {
                        left = n;
                    }
                }

                actualLoanTenure = Math.ceil(n / 12);
                totalLoanPaid = monthlyEMI * Math.ceil(n);
            } else {
                actualLoanTenure = 0;
                totalLoanPaid = 0;
            }
        } else {
            totalLoanPaid = monthlyEMI * numberOfMonths;
        }
        totalLoanPaid = Math.round(totalLoanPaid * 100) / 100;
    }

    const annualSolarGeneration = inputs.kwInstalled * inputs.unitsPerKwDay * 365;
    const annualUnitsConsumed = inputs.avgUnitsConsumed * 12;
    const annualUnitsImported_Y1 = Math.max(0, annualUnitsConsumed - annualSolarGeneration);
    const annualUnitsExported_Y1 = Math.max(0, annualSolarGeneration - annualUnitsConsumed);
    const annualBillBeforeSolar_Y1 = (annualUnitsConsumed * inputs.costPerUnit) + (additionalCharges * 12);
    const annualCostOfImported_Y1 = annualUnitsImported_Y1 * inputs.costPerUnit;
    const annualCreditForExported_Y1 = annualUnitsExported_Y1 * inputs.netMeteringRate;
    const annualBillAfterSolar_Y1 = (annualCostOfImported_Y1 - annualCreditForExported_Y1) + (additionalCharges * 12);
    const annualSavings_Y1 = annualBillBeforeSolar_Y1 - annualBillAfterSolar_Y1;
    const avgMonthlyBillBefore_Y1 = annualBillBeforeSolar_Y1 / 12;
    const avgMonthlyBillAfter_Y1 = annualBillAfterSolar_Y1 / 12;
    const avgMonthlySavings_Y1 = annualSavings_Y1 / 12;

    let simplePaybackYears = Infinity;
    if (netProjectCost <= 0) { simplePaybackYears = 0; }
    else if (annualSavings_Y1 > 0) { simplePaybackYears = netProjectCost / annualSavings_Y1; }

    const totalOutlay = inputs.downPayment + totalLoanPaid;

    // --- 3. Populate Results ---
    const resultsTbody = document.getElementById('resultsTable').getElementsByTagName('tbody')[0];
    resultsTbody.innerHTML = '';

    // Helper to add rows, now includes optional color class
    const addRow = (label, value, valueRaw = null, applyColorClass = false) => {
        const row = resultsTbody.insertRow();
        const labelCell = row.insertCell(0);
        const valueCell = row.insertCell(1);

        labelCell.className = 'metric-col';
        labelCell.innerText = label;

        // Apply color class if needed, wrap value in span
        if (applyColorClass && valueRaw !== null) {
            const colorClass = getColorClass(valueRaw);
            valueCell.innerHTML = `<span class="${colorClass}">${value}</span>`;
        } else {
            valueCell.innerText = value;
        }
    };

    addRow('Total Project Cost', formatCurrency(inputs.totalCost));
    addRow('Subsidy Amount', formatCurrency(inputs.subsidyAmount));
    addRow('Net Project Cost (After Subsidy)', formatCurrency(netProjectCost));
    addRow('Down Payment', formatCurrency(inputs.downPayment));
    addRow('Loan Amount Required', formatCurrency(loanAmount));
    addRow('Monthly Loan EMI', formatCurrency(monthlyEMI));
    if (inputs.subsidyAmount > 0) {
        addRow('Actual Loan Tenure (After Subsidy Repayment)', formatNumber(actualLoanTenure, 0, 'Years'));
    }
    addRow('Total Amount Paid for Loan', formatCurrency(totalLoanPaid));
    addRow('Total Outlay (Down Payment + Loan Paid)', formatCurrency(totalOutlay));
    addRow('Estimated Annual Solar Generation', formatNumber(annualSolarGeneration, 0, 'kWh / Year'));
    addRow('Avg. Monthly Bill (Before Solar - Y1)', formatCurrency(avgMonthlyBillBefore_Y1));
    // Apply color to Avg Bill After if it's a credit (negative value)
    addRow('Avg. Monthly Bill (After Solar - Y1, Annualized)',
        formatCurrency(avgMonthlyBillAfter_Y1) + (avgMonthlyBillAfter_Y1 < 0 ? ' (Avg. Credit)' : ''),
        avgMonthlyBillAfter_Y1,
        avgMonthlyBillAfter_Y1 < 0 // Only apply color if negative (credit)
    );
    // Apply color to Avg Savings if positive
    addRow('Avg. Monthly Savings (Y1, Annualized)',
        formatCurrency(avgMonthlySavings_Y1),
        avgMonthlySavings_Y1,
        avgMonthlySavings_Y1 > 0 // Apply color if positive savings
    );
    addRow('Additional Charges (Monthly)', formatCurrency(additionalCharges));


    let simplePaybackText = "N/A";
    if (simplePaybackYears === 0) simplePaybackText = "Immediate";
    else if (simplePaybackYears !== Infinity && simplePaybackYears > 0) simplePaybackText = formatNumber(simplePaybackYears, 1, 'Years');
    else if (annualSavings_Y1 <= 0 && netProjectCost > 0) simplePaybackText = "N/A (No Savings)";
    addRow('Simple Payback Period (Y1 Savings)', simplePaybackText);

    // --- 4. Generate Detail Tables ---
    generateMonthlyComparisonTable(avgMonthlyBillBefore_Y1, avgMonthlyBillAfter_Y1, monthlyEMI, avgMonthlySavings_Y1);
    const financedBreakevenYearText = generateBreakevenTable(
        netProjectCost, monthlyEMI, inputs.loanTenure,
        annualUnitsConsumed, annualSolarGeneration,
        inputs.costPerUnit, inputs.netMeteringRate, inputs.inflationRate,
        additionalCharges
    );

    addRow('Financed Breakeven Year (Incl. Inflation)', financedBreakevenYearText); // Add last

    // Show results section
    resultsSection.style.display = 'block';
    initialMessage.style.display = 'none';
}

// --- Helper: Generate Monthly Comparison Table (Year 1 Average Snapshot) ---
function generateMonthlyComparisonTable(avgBillBefore_Y1, avgBillAfter_Y1, emi, avgSavings_Y1) {
    const container = document.getElementById('monthlyCostsComparison');
    const additionalCharges = parseFloat(document.getElementById('additionalCharges').value) || 0; // Get additional charges here
    const avgBillAfterPositive = Math.max(0, avgBillAfter_Y1);
    const totalAvgMonthlyOutlay = avgBillAfterPositive + emi;
    const netAvgMonthlyImpact = avgSavings_Y1 - emi;
    const netImpactColorClass = getColorClass(netAvgMonthlyImpact); // Get color class

    let tableHTML = `<table class="data-table">
        <thead>
            <tr>
                <th class="metric-col">Avg. Monthly Item (Year 1)</th>
                <th style="text-align: right;">Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr><td class="metric-col">Electricity Bill (Before Solar)</td><td>${formatCurrency(avgBillBefore_Y1)}</td></tr>
            <tr><td class="metric-col">Additional Charges</td><td>${formatCurrency(additionalCharges)}</td></tr>
            <tr><td class="metric-col">Est. Bill (After Solar, Annualized)</td><td><span class="${getColorClass(avgBillAfter_Y1 < 0 ? 1 : -1)}">${formatCurrency(avgBillAfter_Y1)} ${avgBillAfter_Y1 < 0 ? '(Avg. Credit)' : ''}</span></td></tr>
            <tr><td class="metric-col">Loan EMI (if applicable)</td><td>${formatCurrency(emi)}</td></tr>
            <tr><td class="metric-col"><strong>Total Avg. Monthly Outlay</strong></td><td><strong>${formatCurrency(totalAvgMonthlyOutlay)}</strong></td></tr>
            <tr><td class="metric-col"><strong>Net Avg. Monthly Impact</strong></td><td><strong><span class="${netImpactColorClass}">${formatCurrency(netAvgMonthlyImpact)} ${netAvgMonthlyImpact >= 0 ? '(Net Benefit)' : '(Net Cost)'}</span></strong></td></tr>
        </tbody>
     </table>`;
    container.innerHTML = tableHTML;
}

// --- Helper: Generate Breakeven Table (Uses Annual Figures & Inflation) ---
function generateBreakevenTable(
    netInitialCost, monthlyEMI, loanTenure,
    annualUnitsConsumed, annualSolarGeneration,
    initialCostPerUnit, initialNetMeteringRate, inflationRate,
    initialMonthlyAdditionalCharges
) {
    const container = document.getElementById('breakevenAnalysis');
    const annualEMI = monthlyEMI * 12;
    // Always show 25 years on all screen sizes
    const maxYears = 25;
    let cumulativeNetCashFlow = -netInitialCost;
    const inflationFactor = 1 + (inflationRate / 100);
    const annualUnitsImported = Math.max(0, annualUnitsConsumed - annualSolarGeneration);
    const annualUnitsExported = Math.max(0, annualSolarGeneration - annualUnitsConsumed);

    let tableHTML = `<table class="data-table">
                        <thead>
                            <tr>
                                <th>Year</th>
                                <th style="text-align: right;">Annual Savings (Inflated)</th>
                                <th style="text-align: right;">Annual Loan Payment</th>
                                <th style="text-align: right;">Net Annual Cash Flow</th>
                                <th style="text-align: right;">Cumulative Net Cash Flow</th>
                            </tr>
                        </thead>
                        <tbody>`;

    let breakevenYearNum = -1;
    if (netInitialCost <= 0) breakevenYearNum = 0;

    // Year 0 Row - Apply color to cumulative flow
    tableHTML += `<tr class="${(breakevenYearNum === 0) ? 'highlight-row' : ''}">
                        <td>0</td>
                        <td>${formatCurrency(0)}</td>
                        <td>${formatCurrency(0)}</td>
                        <td><span class="${getColorClass(-netInitialCost)}">${formatCurrency(-netInitialCost)}</span></td>
                        <td><span class="${getColorClass(cumulativeNetCashFlow)}">${formatCurrency(cumulativeNetCashFlow)}</span></td>
                      </tr>`;

    const initialAnnualSavings = (annualUnitsConsumed * initialCostPerUnit) - ((annualUnitsImported * initialCostPerUnit) - (annualUnitsExported * initialNetMeteringRate));

    for (let year = 1; year <= maxYears; year++) {
        const currentCostPerUnit = initialCostPerUnit * Math.pow(inflationFactor, year - 1);
        const currentNetMeteringRate = initialNetMeteringRate * Math.pow(inflationFactor, year - 1);
        const currentAnnualAdditionalCharges = initialMonthlyAdditionalCharges * 12 * Math.pow(inflationFactor, year - 1); // Calculate inflated annual additional charges

        const annualBillBefore_inflated = (annualUnitsConsumed * currentCostPerUnit) + currentAnnualAdditionalCharges; // Add inflated additional charges
        const annualCostOfImported_inflated = annualUnitsImported * currentCostPerUnit;
        const annualCreditForExported_inflated = annualUnitsExported * currentNetMeteringRate;
        const annualBillAfter_inflated = (annualCostOfImported_inflated - annualCreditForExported_inflated) + currentAnnualAdditionalCharges; // Add inflated additional charges
        const currentAnnualSavings = annualBillBefore_inflated - annualBillAfter_inflated;
        const currentAnnualEMI = (year <= loanTenure && annualEMI > 0) ? annualEMI : 0;
        const netAnnualCashFlow = currentAnnualSavings - currentAnnualEMI;
        cumulativeNetCashFlow += netAnnualCashFlow;

        let rowClass = '';
        if (cumulativeNetCashFlow >= 0 && breakevenYearNum === -1) {
            breakevenYearNum = year;
            rowClass = 'highlight-row'; // Highlight breakeven year
        }

        // Apply color classes to cash flow cells
        tableHTML += `<tr class="${rowClass}">
                        <td>${year}</td>
                        <td><span class="${getColorClass(currentAnnualSavings)}">${formatCurrency(currentAnnualSavings)}</span></td>
                        <td>${formatCurrency(currentAnnualEMI)}</td>
                        <td><span class="${getColorClass(netAnnualCashFlow)}">${formatCurrency(netAnnualCashFlow)}</span></td>
                        <td><span class="${getColorClass(cumulativeNetCashFlow)}">${formatCurrency(cumulativeNetCashFlow)}</span></td>
                      </tr>`;
    }

    tableHTML += `</tbody></table>`;

    // Summary text generation
    let summary = '';
    let returnValue = '';
    if (breakevenYearNum === 0) {
        summary = "Immediate Breakeven (Net Project Cost ≤ 0).";
        returnValue = "Immediate";
    } else if (breakevenYearNum > 0) {
        summary = `Financed Breakeven Occurs in Year ${breakevenYearNum}.`;
        returnValue = formatNumber(breakevenYearNum, 0, 'Years');
    } else if (initialAnnualSavings <= 0 && netInitialCost > 0 && inflationRate <= 0) {
        summary = "Breakeven unlikely with no initial savings & no inflation.";
        returnValue = "N/A (No Savings)";
    } else {
        summary = `Breakeven point not reached within ${maxYears} years.`;
        returnValue = `> ${maxYears} Years`;
    }

    container.innerHTML = tableHTML + `<p class="summary-text">${summary}</p>`;
    return returnValue;
}

// --- New: Reset Form Function ---
function resetForm() {
    ['subsidyAmount', 'downPayment', 'loanTenure', 'interestRate', 'kwInstalled', 'unitsPerKwDay', 'avgUnitsConsumed', 'costPerUnit', 'additionalCharges', 'inflationRate', 'netMeteringRate', 'manualKwInput']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.value = '';
                el.classList.remove('input-error');
            }
        });
    const totalEl = document.getElementById('totalCost');
    if (totalEl) {
        totalEl.value = '';
        totalEl.classList.remove('input-error');
        totalEl.placeholder = "Enter project cost"; // Reset placeholder
    }
    document.getElementById('manualKwInputGroup').style.display = 'none'; // Hide manual kW input
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('initialMessage').style.display = 'block';
}

// --- Hook Reset Button Onload ---
window.onload = () => {
    document.getElementById('kwInstalled').value = '3'; // Set to a string to match option value
    // Trigger change to ensure dependent logic runs (like setting totalCost based on map)
    // and to correctly set initial state of manualKwInputGroup
    const event = new Event('change');
    document.getElementById('kwInstalled').dispatchEvent(event);
    // The calculateSavings() will be called by the onchange event, which will populate totalCost
    // So, direct setting of totalCost.value here might be overridden or redundant if not timed correctly.
    // Instead, let calculateSavings handle the initial totalCost population based on kwInstalled.

    // document.getElementById('totalCost').value = 230000; // Let calculateSavings handle this
    document.getElementById('subsidyAmount').value = 78000;
    document.getElementById('downPayment').value = 32000;
    document.getElementById('loanTenure').value = 10;
    document.getElementById('interestRate').value = 6;
    document.getElementById('unitsPerKwDay').value = 4.2;
    document.getElementById('avgUnitsConsumed').value = 400;
    document.getElementById('costPerUnit').value = 8;
    document.getElementById('inflationRate').value = 4.0;
    document.getElementById('netMeteringRate').value = 2.95;

    document.getElementById('initialMessage').style.display = 'block';
    document.getElementById('resultsSection').style.display = 'none';

    document.getElementById('resetBtn').addEventListener('click', resetForm);
};

// --- Calculator Mode Switcher ---
let currentMode = 'capex';

function switchCalculatorMode(mode) {
    currentMode = mode;
    const solarForm = document.getElementById('solarForm');
    const rescoForm = document.getElementById('rescoForm');
    const resultsSection = document.getElementById('resultsSection');
    const rescoResultsSection = document.getElementById('rescoResultsSection');
    const initialMessage = document.getElementById('initialMessage');
    const capexBtn = document.getElementById('capexModeBtn');
    const rescoBtn = document.getElementById('rescoModeBtn');

    if (mode === 'capex') {
        solarForm.style.display = '';
        rescoForm.style.display = 'none';
        rescoResultsSection.style.display = 'none';
        capexBtn.classList.add('active');
        rescoBtn.classList.remove('active');
        // Show results or initial message depending on state
        if (resultsSection.innerHTML.trim() && document.querySelector('#resultsTable tbody tr')) {
            resultsSection.style.display = 'block';
            initialMessage.style.display = 'none';
        } else {
            resultsSection.style.display = 'none';
            initialMessage.style.display = 'block';
        }
    } else {
        solarForm.style.display = 'none';
        rescoForm.style.display = '';
        resultsSection.style.display = 'none';
        rescoBtn.classList.add('active');
        capexBtn.classList.remove('active');
        // Show RESCO results or initial message
        if (rescoResultsSection.innerHTML.trim() && document.querySelector('#rescoSummary .summary-card')) {
            rescoResultsSection.style.display = 'block';
            initialMessage.style.display = 'none';
        } else {
            rescoResultsSection.style.display = 'none';
            initialMessage.style.display = 'block';
        }
    }
}

// --- RESCO Calculation Engine ---
function calculateRESCO() {
    const errorDiv = document.getElementById('rescoErrorMessage');
    const rescoResults = document.getElementById('rescoResultsSection');
    const initialMessage = document.getElementById('initialMessage');
    errorDiv.innerText = '';
    errorDiv.style.display = 'none';
    rescoResults.style.display = 'none';
    initialMessage.style.display = 'none';

    // --- 1. Get and Validate Inputs ---
    const inputIds = [
        'rescoMonthlyUnits', 'rescoCurrentBill', 'rescoAdditionalCharges',
        'rescoDiscomTariff', 'rescoTariffEscalation',
        'rescoSystemCapacity', 'rescoUnitsPerKwDay', 'rescoR2VTariff',
        'rescoR2VEscalation', 'rescoPPATenure', 'rescoSecurityMonths',
        'rescoSystemCost', 'rescoOMCost', 'rescoOMEscalation',
        'rescoAMCCost', 'rescoAMCEscalation', 'rescoPanelDegradation',
        'rescoLoanAmount', 'rescoLoanTenure', 'rescoMoratorium', 'rescoLoanInterest'
    ];

    let inputs = {};
    let errors = [];

    // Clear previous error highlights
    inputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('input-error');
    });

    const requiredPositive = [
        'rescoMonthlyUnits', 'rescoCurrentBill', 'rescoDiscomTariff',
        'rescoSystemCapacity', 'rescoUnitsPerKwDay', 'rescoR2VTariff',
        'rescoPPATenure', 'rescoSystemCost'
    ];

    inputIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const val = parseFloat(el.value);

        if (isNaN(val) && requiredPositive.includes(id)) {
            el.classList.add('input-error');
            const label = el.previousElementSibling ? el.previousElementSibling.innerText.replace(/[:\d.]/g, '').trim() : id;
            errors.push(`Enter a valid value for ${label}.`);
            inputs[id] = NaN;
        } else if (requiredPositive.includes(id) && val <= 0) {
            el.classList.add('input-error');
            const label = el.previousElementSibling ? el.previousElementSibling.innerText.replace(/[:\d.]/g, '').trim() : id;
            errors.push(`${label} must be greater than 0.`);
            inputs[id] = NaN;
        } else {
            inputs[id] = isNaN(val) ? 0 : val;
        }
    });

    if (errors.length > 0) {
        errorDiv.innerHTML = errors.join('<br>');
        errorDiv.style.display = 'block';
        rescoResults.style.display = 'none';
        initialMessage.style.display = 'block';
        return;
    }

    // --- 2. Core Calculations ---
    const monthlyUnits = inputs.rescoMonthlyUnits;
    const currentBill = inputs.rescoCurrentBill;
    const additionalCharges = inputs.rescoAdditionalCharges;
    const discomTariff = inputs.rescoDiscomTariff;
    const tariffEscalation = inputs.rescoTariffEscalation / 100;
    const systemCapacity = inputs.rescoSystemCapacity;
    const unitsPerKwDay = inputs.rescoUnitsPerKwDay;
    const r2vTariff = inputs.rescoR2VTariff;
    const r2vEscalation = inputs.rescoR2VEscalation / 100;
    const ppaTenure = Math.round(inputs.rescoPPATenure);
    const securityMonths = Math.round(inputs.rescoSecurityMonths);
    const systemCost = inputs.rescoSystemCost;
    const omCost = inputs.rescoOMCost;
    const omEscalation = inputs.rescoOMEscalation / 100;
    const amcCost = inputs.rescoAMCCost;
    const amcEscalation = inputs.rescoAMCEscalation / 100;
    const panelDegradation = inputs.rescoPanelDegradation / 100;

    // Loan parameters
    const loanAmount = inputs.rescoLoanAmount || 0;
    const loanTenure = Math.round(inputs.rescoLoanTenure) || 0;
    const moratoriumMonths = Math.round(inputs.rescoMoratorium) || 0;
    const loanInterest = inputs.rescoLoanInterest / 100;

    const baseAnnualGeneration = systemCapacity * unitsPerKwDay * 365;
    const annualConsumption = monthlyUnits * 12;

    // Monthly projected RESCO bill for security deposit
    const monthlyProjectedRescoBill = (baseAnnualGeneration / 12) * r2vTariff;
    const securityDeposit = securityMonths * monthlyProjectedRescoBill;

    // --- Loan EMI Calculation ---
    let monthlyEMI = 0;
    let totalLoanMonths = 0;
    let loanPrincipalAfterMoratorium = loanAmount;

    if (loanAmount > 0 && loanTenure > 0) {
        // During moratorium, interest accrues and is added to principal
        const monthlyRate = loanInterest / 12;
        if (moratoriumMonths > 0 && monthlyRate > 0) {
            loanPrincipalAfterMoratorium = loanAmount * Math.pow(1 + monthlyRate, moratoriumMonths);
        }
        // EMI repayment months (after moratorium)
        totalLoanMonths = (loanTenure * 12) - moratoriumMonths;
        if (totalLoanMonths > 0 && monthlyRate > 0) {
            const powerTerm = Math.pow(1 + monthlyRate, totalLoanMonths);
            monthlyEMI = loanPrincipalAfterMoratorium * monthlyRate * powerTerm / (powerTerm - 1);
        } else if (totalLoanMonths > 0) {
            monthlyEMI = loanPrincipalAfterMoratorium / totalLoanMonths;
        }
        monthlyEMI = isNaN(monthlyEMI) ? 0 : Math.round(monthlyEMI * 100) / 100;
    }

    const annualEMI = monthlyEMI * 12;
    const monthlyInterestOnly = loanAmount * (loanInterest / 12);

    // Build a month-by-month debt service schedule (grouped by year)
    // For each year, calculate how many months are moratorium vs EMI
    function getAnnualDebtService(year) {
        if (loanAmount <= 0 || loanTenure <= 0) return { debtService: 0, interestOnly: 0, emiPayment: 0, isActive: false };

        const yearStartMonth = (year - 1) * 12 + 1; // month 1 of year 1
        const yearEndMonth = year * 12;
        const moratoriumEnd = moratoriumMonths; // moratorium is month 1 to moratoriumMonths
        const loanEndMonth = loanTenure * 12;

        let interestOnlyPayment = 0;
        let emiPayment = 0;

        for (let m = yearStartMonth; m <= yearEndMonth; m++) {
            if (m > loanEndMonth) break; // loan fully repaid
            if (m <= moratoriumEnd) {
                // Interest-only during moratorium
                interestOnlyPayment += monthlyInterestOnly;
            } else {
                // Full EMI
                emiPayment += monthlyEMI;
            }
        }

        return {
            debtService: interestOnlyPayment + emiPayment,
            interestOnly: interestOnlyPayment,
            emiPayment: emiPayment,
            isActive: yearStartMonth <= loanEndMonth
        };
    }

    // --- Year-by-year calculations ---
    let yearData = [];
    // R2V initial outflow: system cost minus loan (equity portion) + receives security deposit
    const equityInvestment = systemCost - loanAmount;
    let r2vCumulativeCashFlow = -equityInvestment + securityDeposit;
    let r2vBreakevenYear = -1;
    let totalR2VRevenue = 0;
    let totalR2VCosts = equityInvestment; // track total cost as equity + operational
    let totalConsumerSavings = 0;
    let totalDebtService = 0;
    let minDSCR = Infinity;
    let avgDSCRSum = 0;
    let avgDSCRCount = 0;

    for (let year = 1; year <= ppaTenure; year++) {
        const degradationFactor = Math.pow(1 - panelDegradation, year - 1);
        const annualGeneration = baseAnnualGeneration * degradationFactor;

        // R2V Revenue
        const currentR2VTariff = r2vTariff * Math.pow(1 + r2vEscalation, year - 1);
        const r2vRevenue = annualGeneration * currentR2VTariff;

        // R2V Operating Costs
        const currentOMCost = omCost * Math.pow(1 + omEscalation, year - 1);
        const currentAMCCost = amcCost * Math.pow(1 + amcEscalation, year - 1);
        const r2vOperatingCosts = currentOMCost + currentAMCCost;

        // Net Operating Income (before debt service)
        const netOperatingIncome = r2vRevenue - r2vOperatingCosts;

        // Debt service for this year
        const debt = getAnnualDebtService(year);
        const debtService = debt.debtService;

        // DSCR = Net Operating Income / Debt Service
        let dscr = 0;
        if (debtService > 0) {
            dscr = netOperatingIncome / debtService;
            if (dscr < minDSCR) minDSCR = dscr;
            avgDSCRSum += dscr;
            avgDSCRCount++;
        }

        // Net cash flow after debt service
        const r2vNetCashFlow = netOperatingIncome - debtService;
        r2vCumulativeCashFlow += r2vNetCashFlow;

        totalR2VRevenue += r2vRevenue;
        totalR2VCosts += r2vOperatingCosts;
        totalDebtService += debtService;

        if (r2vCumulativeCashFlow >= 0 && r2vBreakevenYear === -1) {
            r2vBreakevenYear = year;
        }

        // Consumer calculations
        const currentDiscomTariff = discomTariff * Math.pow(1 + tariffEscalation, year - 1);
        const discomBillEnergy = annualConsumption * currentDiscomTariff;
        const annualAdditional = additionalCharges * 12;
        const discomTotalBill = discomBillEnergy + annualAdditional;

        const unitsFromSolar = Math.min(annualGeneration, annualConsumption);
        const unitsFromGrid = Math.max(0, annualConsumption - annualGeneration);
        const rescoBill = unitsFromSolar * currentR2VTariff;
        const gridCost = unitsFromGrid * currentDiscomTariff;
        const consumerTotalBill = rescoBill + gridCost + annualAdditional;
        const consumerSavings = discomTotalBill - consumerTotalBill;
        totalConsumerSavings += consumerSavings;

        yearData.push({
            year,
            annualGeneration,
            currentR2VTariff,
            r2vRevenue,
            currentOMCost,
            currentAMCCost,
            r2vOperatingCosts,
            netOperatingIncome,
            debtService,
            interestOnly: debt.interestOnly,
            emiPayment: debt.emiPayment,
            dscr,
            debtIsActive: debt.isActive,
            r2vNetCashFlow,
            r2vCumulativeCashFlow,
            currentDiscomTariff,
            discomTotalBill,
            unitsFromSolar,
            unitsFromGrid,
            rescoBill,
            gridCost,
            consumerTotalBill,
            consumerSavings,
        });
    }

    const totalR2VProfit = r2vCumulativeCashFlow;
    const avgDSCR = avgDSCRCount > 0 ? avgDSCRSum / avgDSCRCount : 0;
    if (minDSCR === Infinity) minDSCR = 0;

    // --- 3. Generate Output ---
    generateRESCOSummary(r2vBreakevenYear, totalR2VRevenue, totalR2VCosts, totalR2VProfit,
        totalConsumerSavings, securityDeposit, systemCost, ppaTenure, yearData,
        loanAmount, monthlyEMI, minDSCR, avgDSCR, equityInvestment, totalDebtService);
    generateR2VBreakevenTable(yearData, equityInvestment, securityDeposit, r2vBreakevenYear, loanAmount);
    generateR2VCashFlowTable(yearData, systemCost, equityInvestment, securityDeposit, loanAmount);
    generateConsumerSavingsTable(yearData);

    // Show results
    rescoResults.style.display = 'block';
    initialMessage.style.display = 'none';
}

// --- RESCO Summary Cards ---
function generateRESCOSummary(breakevenYear, totalRevenue, totalCosts, totalProfit,
    consumerSavings, securityDeposit, systemCost, ppaTenure, yearData,
    loanAmount, monthlyEMI, minDSCR, avgDSCR, equityInvestment, totalDebtService) {
    const container = document.getElementById('rescoSummary');

    const breakevenText = breakevenYear > 0 ? `Year ${breakevenYear}` : `> ${ppaTenure} Years`;
    const breakevenColor = breakevenYear > 0 ? 'var(--color-profit)' : 'var(--color-loss)';

    // ROI on total project cost
    const roi = systemCost > 0 ? ((totalProfit / systemCost) * 100) : 0;

    const svgIcons = {
        breakeven: `<svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
        revenue: `<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
        profit: `<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
        roi: `<svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
        savings: `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
        deposit: `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
        dscr: `<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        emi: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
        debt: `<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    };

    const cards = [
        { label: 'R2V Breakeven Year', value: breakevenText, color: breakevenColor, accent: '#10B981', iconBg: 'rgba(16, 185, 129, 0.12)', icon: svgIcons.breakeven },
        { label: 'R2V Total Revenue', value: formatCurrency(totalRevenue), color: 'var(--color-profit)', accent: '#00B4D8', iconBg: 'rgba(0, 180, 216, 0.12)', icon: svgIcons.revenue },
        { label: 'R2V Net Profit', value: formatCurrency(totalProfit), color: totalProfit >= 0 ? 'var(--color-profit)' : 'var(--color-loss)', accent: totalProfit >= 0 ? '#10B981' : '#EF4444', iconBg: totalProfit >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', icon: svgIcons.profit },
        { label: 'Project ROI', value: formatNumber(roi, 1, '%'), color: roi >= 0 ? 'var(--color-profit)' : 'var(--color-loss)', accent: roi >= 0 ? '#8B5CF6' : '#EF4444', iconBg: roi >= 0 ? 'rgba(139, 92, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)', icon: svgIcons.roi },
        { label: 'Consumer Total Savings', value: formatCurrency(consumerSavings), color: consumerSavings >= 0 ? 'var(--color-profit)' : 'var(--color-loss)', accent: '#F59E0B', iconBg: 'rgba(245, 158, 11, 0.12)', icon: svgIcons.savings },
        { label: 'Security Deposit', value: formatCurrency(securityDeposit), color: 'var(--text-primary)', accent: '#6B7280', iconBg: 'rgba(107, 114, 128, 0.12)', icon: svgIcons.deposit },
    ];

    // Add loan-related cards if loan is active
    if (loanAmount > 0) {
        const dscrColor = minDSCR >= 1.2 ? 'var(--color-profit)' : minDSCR >= 1.0 ? '#F59E0B' : 'var(--color-loss)';
        const dscrAccent = minDSCR >= 1.2 ? '#10B981' : minDSCR >= 1.0 ? '#F59E0B' : '#EF4444';
        const dscrIconBg = minDSCR >= 1.2 ? 'rgba(16, 185, 129, 0.12)' : minDSCR >= 1.0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)';

        cards.push(
            { label: 'Min DSCR', value: formatNumber(minDSCR, 2, 'x'), color: dscrColor, accent: dscrAccent, iconBg: dscrIconBg, icon: svgIcons.dscr },
            { label: 'Monthly EMI', value: formatCurrency(monthlyEMI), color: 'var(--text-primary)', accent: '#3B82F6', iconBg: 'rgba(59, 130, 246, 0.12)', icon: svgIcons.emi },
            { label: 'Total Debt Service', value: formatCurrency(totalDebtService), color: 'var(--text-primary)', accent: '#6366F1', iconBg: 'rgba(99, 102, 241, 0.12)', icon: svgIcons.debt },
        );
    }

    let html = '';
    cards.forEach(card => {
        html += `
            <div class="summary-card" style="--card-accent: ${card.accent}; --card-icon-bg: ${card.iconBg}">
                <div class="summary-card-icon">${card.icon}</div>
                <div class="summary-card-label">${card.label}</div>
                <div class="summary-card-value" style="color: ${card.color}">${card.value}</div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// --- R2V Breakeven Table ---
function generateR2VBreakevenTable(yearData, equityInvestment, securityDeposit, breakevenYear, loanAmount) {
    const container = document.getElementById('rescoR2VBreakeven');
    const hasLoan = loanAmount > 0;

    let tableHTML = `<table class="data-table">
        <thead>
            <tr>
                <th>Year</th>
                <th style="text-align: right;">R2V Revenue</th>
                <th style="text-align: right;">Operating Costs</th>
                ${hasLoan ? '<th style="text-align: right;">Debt Service</th>' : ''}
                <th style="text-align: right;">Net Cash Flow</th>
                <th style="text-align: right;">Cumulative</th>
                ${hasLoan ? '<th style="text-align: right;">DSCR</th>' : ''}
            </tr>
        </thead>
        <tbody>`;

    // Year 0: Equity invested + security deposit received
    const year0CashFlow = -equityInvestment + securityDeposit;
    tableHTML += `<tr>
        <td>0</td>
        <td>${formatCurrency(securityDeposit)}</td>
        <td>${formatCurrency(equityInvestment)}</td>
        ${hasLoan ? `<td>${formatCurrency(0)}</td>` : ''}
        <td><span class="${getColorClass(year0CashFlow)}">${formatCurrency(year0CashFlow)}</span></td>
        <td><span class="${getColorClass(year0CashFlow)}">${formatCurrency(year0CashFlow)}</span></td>
        ${hasLoan ? '<td>—</td>' : ''}
    </tr>`;

    yearData.forEach(d => {
        const rowClass = d.year === breakevenYear ? 'highlight-row' : '';
        const dscrText = d.debtIsActive && d.debtService > 0 ? formatNumber(d.dscr, 2, 'x') : '—';
        const dscrClass = d.dscr >= 1.2 ? 'text-profit' : d.dscr >= 1.0 ? '' : 'text-loss';
        tableHTML += `<tr class="${rowClass}">
            <td>${d.year}</td>
            <td>${formatCurrency(d.r2vRevenue)}</td>
            <td>${formatCurrency(d.r2vOperatingCosts)}</td>
            ${hasLoan ? `<td>${formatCurrency(d.debtService)}</td>` : ''}
            <td><span class="${getColorClass(d.r2vNetCashFlow)}">${formatCurrency(d.r2vNetCashFlow)}</span></td>
            <td><span class="${getColorClass(d.r2vCumulativeCashFlow)}">${formatCurrency(d.r2vCumulativeCashFlow)}</span></td>
            ${hasLoan ? `<td><span class="${dscrClass}">${dscrText}</span></td>` : ''}
        </tr>`;
    });

    tableHTML += `</tbody></table>`;

    let summary = '';
    if (breakevenYear > 0) {
        summary = `<p class="summary-text">Ray2Volt recoups equity investment in <strong>Year ${breakevenYear}</strong>.</p>`;
    } else {
        summary = `<p class="summary-text">Ray2Volt does not break even within the PPA tenure.</p>`;
    }

    container.innerHTML = tableHTML + summary;
}

// --- R2V Cash Flow Table ---
function generateR2VCashFlowTable(yearData, systemCost, equityInvestment, securityDeposit, loanAmount) {
    const container = document.getElementById('rescoR2VCashFlow');
    const hasLoan = loanAmount > 0;

    let tableHTML = `<table class="data-table">
        <thead>
            <tr>
                <th>Year</th>
                <th style="text-align: right;">Generation (kWh)</th>
                <th style="text-align: right;">Revenue</th>
                <th style="text-align: right;">O&M</th>
                <th style="text-align: right;">AMC</th>
                ${hasLoan ? '<th style="text-align: right;">Debt Service</th>' : ''}
                <th style="text-align: right;">Net Cash Flow</th>
            </tr>
        </thead>
        <tbody>`;

    // Year 0 row
    const year0Net = -equityInvestment + securityDeposit;
    tableHTML += `<tr>
        <td>0</td>
        <td>—</td>
        <td>${formatCurrency(securityDeposit)}</td>
        <td>—</td>
        <td>—</td>
        ${hasLoan ? '<td>—</td>' : ''}
        <td><span class="${getColorClass(year0Net)}">${formatCurrency(year0Net)}</span></td>
    </tr>`;

    yearData.forEach(d => {
        tableHTML += `<tr>
            <td>${d.year}</td>
            <td>${formatNumber(d.annualGeneration, 0, 'kWh')}</td>
            <td>${formatCurrency(d.r2vRevenue)}</td>
            <td>${formatCurrency(d.currentOMCost)}</td>
            <td>${formatCurrency(d.currentAMCCost)}</td>
            ${hasLoan ? `<td>${formatCurrency(d.debtService)}</td>` : ''}
            <td><span class="${getColorClass(d.r2vNetCashFlow)}">${formatCurrency(d.r2vNetCashFlow)}</span></td>
        </tr>`;
    });

    tableHTML += `</tbody></table>`;

    // Totals summary
    const totalRevenue = yearData.reduce((s, d) => s + d.r2vRevenue, 0);
    const totalOM = yearData.reduce((s, d) => s + d.currentOMCost, 0);
    const totalAMC = yearData.reduce((s, d) => s + d.currentAMCCost, 0);
    const totalDebt = yearData.reduce((s, d) => s + d.debtService, 0);
    const totalNetCF = yearData.reduce((s, d) => s + d.r2vNetCashFlow, 0);

    let summaryParts = [
        `Revenue: ${formatCurrency(totalRevenue)}`,
        `O&M: ${formatCurrency(totalOM)}`,
        `AMC: ${formatCurrency(totalAMC)}`,
    ];
    if (hasLoan) summaryParts.push(`Debt Service: ${formatCurrency(totalDebt)}`);
    summaryParts.push(`Net Cash Flow: ${formatCurrency(totalNetCF)}`);

    const totalsSummary = `<p class="summary-text">
        <strong>Totals over PPA:</strong> ${summaryParts.join(' | ')}
    </p>`;

    container.innerHTML = tableHTML + totalsSummary;
}

// --- Consumer Savings Table ---
function generateConsumerSavingsTable(yearData) {
    const container = document.getElementById('rescoConsumerSavings');

    let tableHTML = `<table class="data-table">
        <thead>
            <tr>
                <th>Year</th>
                <th style="text-align: right;">DISCOM Bill (w/o Solar)</th>
                <th style="text-align: right;">RESCO Bill</th>
                <th style="text-align: right;">Grid Bill (Remaining)</th>
                <th style="text-align: right;">Total with RESCO</th>
                <th style="text-align: right;">Annual Savings</th>
            </tr>
        </thead>
        <tbody>`;

    let cumulativeSavings = 0;
    yearData.forEach(d => {
        cumulativeSavings += d.consumerSavings;
        tableHTML += `<tr>
            <td>${d.year}</td>
            <td>${formatCurrency(d.discomTotalBill)}</td>
            <td>${formatCurrency(d.rescoBill)}</td>
            <td>${formatCurrency(d.gridCost)}</td>
            <td>${formatCurrency(d.consumerTotalBill)}</td>
            <td><span class="${getColorClass(d.consumerSavings)}">${formatCurrency(d.consumerSavings)}</span></td>
        </tr>`;
    });

    tableHTML += `</tbody></table>`;

    const totalSavings = yearData.reduce((s, d) => s + d.consumerSavings, 0);
    const summary = `<p class="summary-text">
        <strong>Total Consumer Savings over PPA Tenure:</strong> <span class="${getColorClass(totalSavings)}">${formatCurrency(totalSavings)}</span>
    </p>`;

    container.innerHTML = tableHTML + summary;
}

// --- Report Modal & Print Logic ---

function openReportModal() {
    const modal = document.getElementById('reportModal');
    const reqGrid = document.getElementById('reqSummaryGrid');
    const reportFinancial = document.getElementById('reportFinancialTable');
    const reportMonthly = document.getElementById('reportMonthlyTable');
    const reportBreakeven = document.getElementById('reportBreakevenTable');

    // 0. Set Report Date
    const dateEl = document.getElementById('reportDate');
    if (dateEl) {
        const now = new Date();
        dateEl.textContent = 'Generated on ' + now.toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    // 1. Populate Requirements Summary
    const inputs = {
        'System Capacity': document.getElementById('kwInstalled').value === 'manual'
            ? `${document.getElementById('manualKwInput').value} kW`
            : `${document.getElementById('kwInstalled').value} kW`,
        'Total Project Cost': formatCurrency(document.getElementById('totalCost').value),
        'Subsidy': formatCurrency(document.getElementById('subsidyAmount').value),
        'Down Payment': formatCurrency(document.getElementById('downPayment').value),
        'Loan Tenure': `${document.getElementById('loanTenure').value} Years`,
        'Interest Rate': `${document.getElementById('interestRate').value}%`,
        'Monthly Consumption': `${document.getElementById('avgUnitsConsumed').value} kWh`,
        'Grid Rate': `₹${document.getElementById('costPerUnit').value} / kWh`
    };

    let gridHTML = '';
    for (const [label, value] of Object.entries(inputs)) {
        gridHTML += `
            <div class="req-item">
                <span class="req-label">${label}</span>
                <span class="req-value">${value}</span>
            </div>
        `;
    }
    reqGrid.innerHTML = gridHTML;

    // 2. Clone Tables into report containers
    const resultsTableOriginal = document.getElementById('resultsTable');
    if (resultsTableOriginal) {
        reportFinancial.innerHTML = '';
        reportFinancial.appendChild(resultsTableOriginal.cloneNode(true));
    }

    const monthlyTableOriginal = document.querySelector('#monthlyCostsComparison table');
    if (monthlyTableOriginal) {
        reportMonthly.innerHTML = '';
        reportMonthly.appendChild(monthlyTableOriginal.cloneNode(true));
    }

    const breakevenTableOriginal = document.querySelector('#breakevenAnalysis table');
    if (breakevenTableOriginal) {
        reportBreakeven.innerHTML = '';
        reportBreakeven.appendChild(breakevenTableOriginal.cloneNode(true));

        // Also clone the summary text
        const breakevenSummaryOriginal = document.querySelector('#breakevenAnalysis .summary-text');
        if (breakevenSummaryOriginal) {
            reportBreakeven.appendChild(breakevenSummaryOriginal.cloneNode(true));
        }
    }

    // 3. Show Modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeReportModal() {
    const modal = document.getElementById('reportModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function printReport() {
    window.print();
}

// Close modal when clicking outside
document.getElementById('reportModal').addEventListener('click', function (e) {
    if (e.target === this) {
        closeReportModal();
    }
});