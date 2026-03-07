import mongoose from 'mongoose';
import Company from '../models/company.js';
import Party from '../models/party.js';
import Stock from '../models/stock.js';
import Transaction from '../models/transaction.js';
import { EmailContent } from './emailService.js';

/**
 * ReportGenerator creates email content for different types of reports
 */
export class ReportGenerator {

    /**
     * Generates an outward transaction report for a specific D.O. number
     * @param doNumber - The D.O. number to generate report for
     * @param partyId - The party ID to send the report to
     * @returns Promise<EmailContent> - The email content with HTML and subject
     */
    static async generateOutwardReport(batchId: string, partyId: string): Promise<EmailContent> {
        try {
            // Fetch transactions for the specific D.O. number and party
            const transactions = await Transaction.find({
                batchId: batchId,
                party: new mongoose.Types.ObjectId(partyId),
                type: 'OUTWARD'
            })
                .populate('party', 'name orgEmail')
                .populate('item', 'name category')
                .sort({ enteredAt: 1 })
                .lean();

            if (transactions.length === 0) {
                throw new Error('No outward transactions found for the specified BatchId');
            }

            // Get party and company information
            const party = await Party.findById(partyId).lean();
            const company = await Company.findOne().lean();

            if (!party) {
                throw new Error('Party not found');
            }
            // Get array of lot Numbers
            const lotNumbers = transactions.map((transaction: any) => transaction.lotNumber);
            // Get Current Stock Details from Stocks
            const stocks = await Stock.find({
                lotNumber: { $in: lotNumbers }
            })

            if (stocks.length === 0) {
                throw new Error('No stock found for the specified lot numbers');
            }

            const doNumber = transactions[0].doNumber;

            // Generate email content
            const subject = `Outward Delivery Report - D.O. ${doNumber}`;
            const html = await this.generateOutwardReportHTML(transactions, stocks, party, company, doNumber);

            return {
                subject,
                html,
                attachments: []
            };
        } catch (error) {
            throw new Error(`Failed to generate outward report: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generates HTML content for outward transaction report
     * @param transactions - Array of transaction data
     * @param party - Party information
     * @param company - Company information
     * @param doNumber - D.O. number
     * @returns Promise<string> - HTML content for the email
     */
    private static async generateOutwardReportHTML(
        transactions: any[],
        stocks: any[],
        party: any,
        company: any,
        doNumber: string
    ): Promise<string> {
        const firstTransaction = transactions[0];
        const deliveryDate = new Date(firstTransaction.enteredAt).toLocaleDateString();
        // Get unique vehicle numbers
        const vehicleNumbers = [...new Set(transactions.map(t => t.vehicleNumber).filter(Boolean))];
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Outward Delivery Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 5px;
        }
        .report-title {
            font-size: 18px;
            color: #666;
            margin-bottom: 10px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        .info-section {
            background-color: #f8fafc;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #2563eb;
        }
        .info-label {
            font-weight: bold;
            color: #374151;
            margin-bottom: 5px;
        }
        .info-value {
            color: #6b7280;
        }
        .transactions-table {
            width: 70%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        .transactions-table th,
        .transactions-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        .transactions-table th {
            background-color: #f3f4f6;
            font-weight: bold;
            color: #374151;
        }
        .transactions-table tr:hover {
            background-color: #f9fafb;
        }
        .summary {
            background-color: #ecfdf5;
            border: 1px solid #d1fae5;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .summary-title {
            font-size: 16px;
            font-weight: bold;
            color: #065f46;
            margin-bottom: 10px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
        }
        .summary-item {
            text-align: center;
        }
        .summary-number {
            font-size: 24px;
            font-weight: bold;
            color: #059669;
        }
        .summary-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
        }
        @media (max-width: 600px) {
            .info-grid {
                grid-template-columns: 1fr;
            }
            .summary-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="company-name">${company?.warehouseName || process.env.VITE_APP_NAME || 'Warehouse CRM'}</div>
            <div class="report-title">Outward Delivery Report</div>
            <div style="color: #6b7280; font-size: 14px;">D.O. Number: ${doNumber}</div>
        </div>

        <div class="info-grid">
            <div class="info-section">
                <div class="info-label">Party Details</div>
                <div class="info-value">
                    <strong>${party.name}</strong><br>
                    ${party.address || ''}<br>
                    ${party.orgEmail || ''}
                </div>
            </div> 
            <br>
            <div class="info-section">
                <div class="info-label">Delivery Information</div>
                <div class="info-value">
                    <strong>Date:</strong> ${deliveryDate}<br>
                    <strong>D.O. Number:</strong> ${doNumber}<br>
                    ${vehicleNumbers.length > 0 ? `<strong>Vehicle(s):</strong> ${vehicleNumbers.join(', ')}<br>` : ''}
                </div>
            </div>
        </div>

        <table class="transactions-table">
            <thead>
                <tr>
                    <th>Item Names</th>
                    <th>Lot No.</th>
                    <th>Quantity</th>
                    <th>Balance Qty</th>
                </tr>
            </thead>
            <tbody>
                ${transactions.map(transaction => `
                    <tr>
                        <td>
                            <strong>${transaction.item?.name || 'N/A'}</strong><br>
                            <small style="color: #6b7280;">${transaction.item?.category || ''}</small>
                        </td>
                        <td>${transaction.lotNumber && transaction.lotNumber.split('|').at(-1)}</td>
                        <td> ${transaction.quantity} </td>
                        <td> ${stocks.find((stock: any) => stock.lotNumber === transaction.lotNumber)?.quantity || '0'} </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="footer">
            <p>This is an automated delivery notification from ${company?.warehouseName || process.env.VITE_APP_NAME || 'Warehouse CRM'}.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Generates a monthly stock report for a specific party
     * @param month - Month (1-12)
     * @param year - Year
     * @param partyId - The party ID to generate report for
     * @returns Promise<EmailContent> - The email content with HTML and attachments
     */
    static async generateMonthlyStockReport(month: number, year: number, partyId: string): Promise<EmailContent> {
        try {
            // Import Stock model
            const Stock = (await import('../models/stock.js')).default;

            // Get date range for the month
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59, 999);

            // Fetch stock data for the party within the month
            const stocks = await Stock.find({
                party: new mongoose.Types.ObjectId(partyId),
                $or: [
                    { earliestEntryAt: { $lte: endDate } },
                    { latestEntryAt: { $gte: startDate } }
                ]
            })
                .populate('party', 'name orgEmail address')
                .populate('item', 'name category')
                .populate('unit', 'name rate')
                .populate('warehouses', 'name')
                .sort({ 'item.name': 1 })
                .lean();

            // Get party and company information
            const party = await Party.findById(partyId).lean();
            const company = await Company.findOne().lean();

            if (!party) {
                throw new Error('Party not found');
            }

            // Generate email content
            const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' });
            const subject = `Monthly Stock Report - ${monthName} ${year}`;
            const html = await this.generateMonthlyStockReportHTML(stocks, party, company, month, year);

            return {
                subject,
                html,
                attachments: [] // PDF attachment could be added here in the future
            };
        } catch (error) {
            throw new Error(`Failed to generate monthly stock report: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generates HTML content for monthly stock report
     * @param stocks - Array of stock data
     * @param party - Party information
     * @param company - Company information
     * @param month - Month number
     * @param year - Year
     * @returns Promise<string> - HTML content for the email
     */
    private static async generateMonthlyStockReportHTML(
        stocks: any[],
        party: any,
        company: any,
        month: number,
        year: number
    ): Promise<string> {
        const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' });
        const activeStocks = stocks.filter(s => s.quantity > 0);
        // filter nil stock that became nil in this month
        const nilStocks = stocks.filter(s => s.isNil && new Date(s.latestEntryAt).getMonth() === month - 1 && new Date(s.latestEntryAt).getFullYear() === year);

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Monthly Stock Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #059669;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #059669;
            margin-bottom: 5px;
        }
        .report-title {
            font-size: 18px;
            color: #666;
            margin-bottom: 10px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        .info-section {
            background-color: #f0fdf4;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #059669;
        }
        .info-label {
            font-weight: bold;
            color: #374151;
            margin-bottom: 5px;
        }
        .info-value {
            color: #6b7280;
        }
        .summary {
            background-color: #ecfdf5;
            border: 1px solid #d1fae5;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .summary-title {
            font-size: 16px;
            font-weight: bold;
            color: #065f46;
            margin-bottom: 15px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 15px;
        }
        .summary-item {
            text-align: center;
        }
        .summary-number {
            font-size: 24px;
            font-weight: bold;
            color: #059669;
        }
        .summary-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
        }
        .stocks-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        .stocks-table th,
        .stocks-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        .stocks-table th {
            background-color: #f3f4f6;
            font-weight: bold;
            color: #374151;
        }
        .stocks-table tr:hover {
            background-color: #f9fafb;
        }
        .quantity-positive {
            color: #059669;
            font-weight: bold;
        }
        .quantity-zero {
            color: #dc2626;
            font-weight: bold;
        }
        .section-title {
            font-size: 18px;
            font-weight: bold;
            color: #374151;
            margin: 30px 0 15px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #e5e7eb;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
        }
        @media (max-width: 600px) {
            .info-grid {
                grid-template-columns: 1fr;
            }
            .summary-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="company-name">${company?.warehouseName || process.env.VITE_APP_NAME || 'Warehouse CRM'}</div>
            <div class="report-title">Monthly Stock Report</div>
            <div style="color: #6b7280; font-size: 14px;">${monthName} ${year}</div>
        </div>

        <div class="info-grid">
            <div class="info-section">
                <div class="info-label">Party Details</div>
                <div class="info-value">
                    <strong>${party.name}</strong><br>
                    ${party.address || ''}<br>
                    ${party.orgEmail || ''}
                </div>
            </div>
            <br>
            <div class="info-section">
                <div class="info-label">Report Period</div>
                <div class="info-value">
                    <strong>Month:</strong> ${monthName} ${year}<br>
                    <strong>Generated:</strong> ${new Date().toLocaleDateString()}<br>
                    <strong>Status:</strong> ${stocks.length > 0 ? 'Active' : 'No Stock'}
                </div>
            </div>
        </div>

        ${activeStocks.length > 0 ? `
        <div class="section-title">Active Stock Items</div>
        <table class="stocks-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Lot Number</th>
                    <th>Quantity</th>
                    <th>Packaging</th>
                    <th>Inward Dates</th>
                </tr>
            </thead>
            <tbody>
                ${activeStocks.map(stock => `
                    <tr>
                        <td>
                            <strong>${stock.item?.name || 'N/A'}</strong><br>
                        </td>
                        <td>${stock.lotNumber && stock.lotNumber.split('|').at(-1)}</td>
                        <td>${stock.quantity} </td>
                        <td>${stock.unit?.name || 'N/A'}</td>
                        <td>${stock.inwardDates.map((date: string) => new Date(date).toLocaleDateString(
            'en-GB',
            { day: 'numeric', month: 'short', year: 'numeric' }
        )).join(', ')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ` : ''}

        ${nilStocks.length > 0 ? `
        <div class="section-title">Nil Stock Items</div>
        <table class="stocks-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Lot Number</th>
                    <th>Packaging</th>
                    <th>Last Date</th>
                </tr>
            </thead>
            <tbody>
                ${nilStocks.map(stock => `
                    <tr>
                        <td>
                            <strong>${stock.item?.name || 'N/A'}</strong><br>
                        </td>
                        <td>${stock.lotNumber && stock.lotNumber.split('|').at(-1)}</td>
                        <td>${stock.unit?.name || 'N/A'}</td>
                        <td>${new Date(stock.latestEntryAt).toLocaleDateString(
            'en-GB',
            { day: 'numeric', month: 'short', year: 'numeric' }
        )}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ` : ''}

        <div class="footer">
            <p>This is an automated monthly stock report from ${company?.warehouseName || process.env.VITE_APP_NAME || 'Warehouse CRM'}.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`;
    }
}

/**
 * Default export for the ReportGenerator class
 */
export default ReportGenerator;