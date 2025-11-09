// Converts proprietary numerical position array to chess notation (e.g. [0,0] -> a0)
export const numericalToNotated = (position) => {
	const fileNotation = "abcdefghi";
	return String(fileNotation[position[0]] + position[1]);
};

// Converts chess notation to proprietary numerical position array  (e.g. a0 -> [0,0])
export const notatedToNumerical = (notatedPosition) => {
	const fileNotation = "abcdefghi";
	return [fileNotation.indexOf(notatedPosition[0]), Number(notatedPosition[1])];
};

// Deep Copy Board Object
export const deepCopyBoard = (boardState) => {
	return JSON.parse(JSON.stringify(boardState));
};
