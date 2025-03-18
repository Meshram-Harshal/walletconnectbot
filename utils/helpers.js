/**
 * Validates if a string is a valid Ethereum-compatible address
 * @param {string} address - The address to validate
 * @returns {boolean} Whether the address is valid
 */
function isValidWalletAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Formats a wallet address for display (shortens it)
 * @param {string} address - The full wallet address
 * @returns {string} The shortened address
 */
function formatWalletAddress(address) {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

module.exports = {
  isValidWalletAddress,
  formatWalletAddress
};