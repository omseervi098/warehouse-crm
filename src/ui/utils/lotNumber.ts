
export const generateAbbreviation = (name: string, maxLength: number = 4, useFullName: boolean = false): string => {
    if (!name) return '';
    if (useFullName) {
        return name.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '-').toUpperCase();
    }
    const words = name.replace(/[^a-zA-Z0-9\s]/g, '').split(' ').filter(Boolean);
    if (words.length > 1) {
        return words.map(word => word[0]).join('').slice(0, maxLength).toUpperCase();
    }
    return name.replace(/[^a-zA-Z0-9]/g, '').slice(0, maxLength).toUpperCase();
};

export const getFinancialYearString = (date: string | Date): string => {
    if (!date) return '';
    const dt = date instanceof Date ? date : new Date(date);
    let year = dt.getFullYear();
    const month = dt.getMonth() + 1;
    if (month < 4) {
        year -= 1;
    }
    let nextYear = year + 1;
    return `${year.toString().slice(-2)}-${nextYear.toString().slice(-2)}`;
}

export const constructLotNumber = (
    partyName: string,
    itemName: string,
    date: string,
    userInputLot: string,
): string => {
    const partyAbbr = generateAbbreviation(partyName, 3);
    const itemAbbr = generateAbbreviation(itemName, 4, true);
    const financialYear = getFinancialYearString(date);
    const cleanUserInput = userInputLot || '';
    return `${partyAbbr}|${financialYear}|${itemAbbr}|${cleanUserInput}`;
};

export const getDisplayLotNumber = (fullLotNumber: string): string => {
    if (!fullLotNumber || typeof fullLotNumber !== 'string') return '';
    const parts = fullLotNumber.split('|');
    // The first 3 parts are Party, Year, Item. The rest is user input.
    if (parts.length > 3) {
        return parts.slice(3).join('|');
    }
    return fullLotNumber;
};
