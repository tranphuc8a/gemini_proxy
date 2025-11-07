import { includesPosition } from "./includesPosition";

export const movementRules = {
	general: ({ startFile, startRank }) => {
		return [
			[startFile + 1, startRank],
			[startFile - 1, startRank],
			[startFile, startRank + 1],
			[startFile, startRank - 1],
		];
	},

	advisor: ({ startFile, startRank }) => {
		return [
			[startFile + 1, startRank + 1],
			[startFile - 1, startRank + 1],
			[startFile + 1, startRank - 1],
			[startFile - 1, startRank - 1],
		];
	},

	elephant: ({ allPositions, startFile, startRank }) => {
		const availableDestinations = [];
		const movementVectors = [
			[1, 1],
			[-1, 1],
			[1, -1],
			[-1, -1],
		];

		for (let i = 0; i < movementVectors.length; ++i) {
			const fileMovement = movementVectors[i][0];
			const rankMovement = movementVectors[i][1];

			const intermediatePosition = [
				startFile + fileMovement,
				startRank + rankMovement,
			];

			if (!includesPosition(intermediatePosition, allPositions)) {
				const finalPosition = [
					startFile + fileMovement * 2,
					startRank + rankMovement * 2,
				];

				availableDestinations.push(finalPosition);
			}
		}

		return availableDestinations;
	},

	horse: ({ allPositions, startFile, startRank }) => {
		const availableDestinations = [];
		const orthogonalVectors = [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		];

		for (let i = 0; i < orthogonalVectors.length; ++i) {
			const fileMovement = orthogonalVectors[i][0];
			const rankMovement = orthogonalVectors[i][1];

			const intermediatePosition = [
				startFile + fileMovement,
				startRank + rankMovement,
			];

			if (!includesPosition(intermediatePosition, allPositions)) {
				if (!rankMovement) {
					availableDestinations.push(
						[startFile + fileMovement * 2, startRank + 1],
						[startFile + fileMovement * 2, startRank - 1]
					);
				} else if (!fileMovement) {
					availableDestinations.push(
						[startFile + 1, startRank + rankMovement * 2],
						[startFile - 1, startRank + rankMovement * 2]
					);
				}
			}
		}

		return availableDestinations;
	},

	chariot: ({ startFile, startRank }) => {
		const availableDestinations = [];

		for (let i = 1; i <= 9; ++i) {
			availableDestinations.push(
				[startFile + i, startRank],
				[startFile - i, startRank],
				[startFile, startRank + i],
				[startFile, startRank - i]
			);
		}

		return availableDestinations;
	},

	cannon: ({ startFile, startRank }) => {
		const availableDestinations = [];

		for (let i = 1; i <= 9; ++i) {
			availableDestinations.push(
				[startFile + i, startRank],
				[startFile - i, startRank],
				[startFile, startRank + i],
				[startFile, startRank - i]
			);
		}

		return availableDestinations;
	},

	soldier: ({ pieceSide, startFile, startRank }) => {
		const soldierMovementRules = {
			red: {
				forwardMovement: 1,
				upgradeRanks: [5, 6, 7, 8, 9],
			},
			black: {
				forwardMovement: -1,
				upgradeRanks: [0, 1, 2, 3, 4],
			},
		};

		const availableDestinations = [];
		const soldierSideSpecificMovement = soldierMovementRules[pieceSide];

		if (!soldierSideSpecificMovement.upgradeRanks.includes(startRank)) {
			availableDestinations.push([
				startFile,
				startRank + soldierSideSpecificMovement.forwardMovement,
			]);
		} else {
			availableDestinations.push(
				[startFile + 1, startRank],
				[startFile - 1, startRank],
				[startFile, startRank + soldierSideSpecificMovement.forwardMovement]
			);
		}

		return availableDestinations;
	},
};
