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
        'totalCost', 'subsidyAmount', 'downPayment', 'loanTenure',
        'interestRate', 'kwInstalled', 'unitsPerKwDay', 'avgUnitsConsumed',
        'costPerUnit', 'inflationRate', 'netMeteringRate'
    ];

    inputIds.forEach(id => {
        const element = document.getElementById(id);
        const value = (id === 'loanTenure') ? parseInt(element.value, 10) : parseFloat(element.value);
        if (isNaN(value) || (value < 0 && !['interestRate', 'subsidyAmount', 'downPayment', 'inflationRate', 'netMeteringRate'].includes(id))) {
             let fieldName = element.previousElementSibling.innerText.replace(/[:\d.]/g, '').trim();
             errors.push(`Enter a valid value for ${fieldName}.`);
             inputs[id] = NaN;
        } else {
            inputs[id] = value;
        }
    });

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
        if(resultsTbody) resultsTbody.innerHTML = '';
        document.getElementById('monthlyCostsComparison').innerHTML = '';
        document.getElementById('breakevenAnalysis').innerHTML = '';
        return;
    }

    // --- 2. Core Calculations (Financial & Annual Energy Balance) ---
    const netProjectCost = Math.max(0, inputs.totalCost - inputs.subsidyAmount);
    const loanAmount = Math.max(0, netProjectCost - inputs.downPayment);

    let monthlyEMI = 0;
    let totalLoanPaid = 0;
    const numberOfMonths = inputs.loanTenure * 12;

    if (loanAmount > 0 && numberOfMonths > 0) {
        const annualInterestRate = inputs.interestRate;
        if (annualInterestRate > 0) {
            const monthlyInterestRate = annualInterestRate / 12 / 100;
            const powerTerm = Math.pow(1 + monthlyInterestRate, numberOfMonths);
            const emiNumerator = loanAmount * monthlyInterestRate * powerTerm;
            const emiDenominator = powerTerm - 1;
            monthlyEMI = (emiDenominator > 0) ? (emiNumerator / emiDenominator) : (loanAmount / numberOfMonths);
        } else { monthlyEMI = loanAmount / numberOfMonths; }
        monthlyEMI = isNaN(monthlyEMI) ? 0 : Math.round(monthlyEMI * 100) / 100;
        totalLoanPaid = monthlyEMI * numberOfMonths;
        totalLoanPaid = Math.round(totalLoanPaid * 100) / 100;
    }

    const annualSolarGeneration = inputs.kwInstalled * inputs.unitsPerKwDay * 365;
    const annualUnitsConsumed = inputs.avgUnitsConsumed * 12;
    const annualUnitsImported_Y1 = Math.max(0, annualUnitsConsumed - annualSolarGeneration);
    const annualUnitsExported_Y1 = Math.max(0, annualSolarGeneration - annualUnitsConsumed);
    const annualBillBeforeSolar_Y1 = annualUnitsConsumed * inputs.costPerUnit;
    const annualCostOfImported_Y1 = annualUnitsImported_Y1 * inputs.costPerUnit;
    const annualCreditForExported_Y1 = annualUnitsExported_Y1 * inputs.netMeteringRate;
    const annualBillAfterSolar_Y1 = annualCostOfImported_Y1 - annualCreditForExported_Y1;
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
        inputs.costPerUnit, inputs.netMeteringRate, inputs.inflationRate
    );

    addRow('Financed Breakeven Year (Incl. Inflation)', financedBreakevenYearText); // Add last

    // Show results section
    resultsSection.style.display = 'block';
    initialMessage.style.display = 'none';
}

// --- Helper: Generate Monthly Comparison Table (Year 1 Average Snapshot) ---
function generateMonthlyComparisonTable(avgBillBefore_Y1, avgBillAfter_Y1, emi, avgSavings_Y1) {
     const container = document.getElementById('monthlyCostsComparison');
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
    initialCostPerUnit, initialNetMeteringRate, inflationRate
) {
    const container = document.getElementById('breakevenAnalysis');
    const annualEMI = monthlyEMI * 12;
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
        const annualBillBefore_inflated = annualUnitsConsumed * currentCostPerUnit;
        const annualCostOfImported_inflated = annualUnitsImported * currentCostPerUnit;
        const annualCreditForExported_inflated = annualUnitsExported * currentNetMeteringRate;
        const annualBillAfter_inflated = annualCostOfImported_inflated - annualCreditForExported_inflated;
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

    // Summary text generation remains the same
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


 // --- Optional: Pre-fill Example on Load ---
 window.onload = () => {
    document.getElementById('kwInstalled').value = 3;
    document.getElementById('totalCost').value = 230000;
    document.getElementById('subsidyAmount').value = 78000;
    document.getElementById('downPayment').value = 32000;
    document.getElementById('loanTenure').value = 10;
    document.getElementById('interestRate').value = 6.75;
    document.getElementById('unitsPerKwDay').value = 3.2;
    document.getElementById('avgUnitsConsumed').value = 400;
    document.getElementById('costPerUnit').value = 8;
    document.getElementById('inflationRate').value = 4.0;
    document.getElementById('netMeteringRate').value = 2.95;

    document.getElementById('initialMessage').style.display = 'block';
    document.getElementById('resultsSection').style.display = 'none';

    // Uncomment below to run calculation automatically on load
    // calculateSavings();
 }; 