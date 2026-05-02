/**
 * CORE BUSINESS LOGIC for JitTest Web
 * 
 * Formula: 
 * Locked Balance = (Ongoing Apps + Production Access Apps) * 50
 * Total Potential Value (TPV) = Locked Balance + Paid Amount + Total Paid Amount
 * TPV must ALWAYS remain constant across all testers.
 */

export const calculateExpectedLockedBalance = (ongoingAppsCount, productionAppsCount) => {
    return (ongoingAppsCount + productionAppsCount) * 50;
};

/**
 * Validates an Admin manual edit to ensure it doesn't break equality rules.
 */
export const validateAdminBalanceEdit = (tester, newLocked, newPaid, newTotalPaid, globalTPV) => {
    const testerTPV = newLocked + newPaid + newTotalPaid;
    
    if (testerTPV !== globalTPV) {
        return {
            isValid: false,
            warning: `Validation Failed! Total Potential Value must be ${globalTPV} for all testers. Your edit results in ${testerTPV}.`
        };
    }
    
    return { isValid: true };
};