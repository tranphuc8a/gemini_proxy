// Test if a position is included in an array of positions
export const includesPosition = (searchPosition, positionsList) => {
	for (let i = 0; i < positionsList.length; i++) {
		if (
			positionsList[i][0] === searchPosition[0] &&
			positionsList[i][1] === searchPosition[1]
		) {
			return true;
		}
	}
	return false;
};
