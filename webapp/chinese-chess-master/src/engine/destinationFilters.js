import { definedPathsRules } from "./boardSetup.js";
import { includesPosition } from "./includesPosition.js";

// Check if available destinations exist within board limits
// Level 1 Function
export const onBoardFilter = ({ destinations }) => {
	return destinations.filter(
		([file, rank]) => file >= 0 && file <= 9 && rank >= 0 && rank <= 9
	);
};

// Check if available destinations fall within defined paths
// Level 1 Function
export const definedPathsFilter = ({ destinations, pieceType, pieceSide }) => {
	if (pieceType in definedPathsRules[pieceSide]) {
		return destinations.filter((dest) =>
			includesPosition(dest, definedPathsRules[pieceSide][pieceType])
		);
	} else {
		return destinations;
	}
};

// Check if available destination is a move or capture (contains special rules for chariot and cannon)
// Level 1 Function Object
export const moveOrCaptureFilter = {
	// All Pieces Except Chariot and Cannon
	default: ({ destinations, friendlyPositions, enemyPositions }) => {
		const filteredDestinations = {
			move: [],
			capture: [],
		};

		destinations.forEach((dest) => {
			// If destination contains enemy unit, push as capture
			if (includesPosition(dest, enemyPositions)) {
				filteredDestinations.capture.push(dest);

				// If destination doesn't contain friend unit, push as move
			} else if (!includesPosition(dest, friendlyPositions)) {
				filteredDestinations.move.push(dest);
			}
		});

		return filteredDestinations;
	},

	chariot: ({
		destinations,
		friendlyPositions,
		enemyPositions,
		startFile,
		startRank,
	}) => {
		const filteredDestinations = {
			move: [],
			capture: [],
		};

		const movementVectors = [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		];

		for (let i = 0; i < movementVectors.length; ++i) {
			// Looping through each direction (right, left, up, down)

			const fileVector = movementVectors[i][0]; // 1
			const rankVector = movementVectors[i][1]; // 0

			for (let j = 1; j <= 9; ++j) {
				// Looping through 9 orthogonal steps

				const orthogonalDestination = [
					startFile + fileVector * j,
					startRank + rankVector * j,
				]; // [1*1, 0*1]

				if (includesPosition(orthogonalDestination, destinations)) {
					if (includesPosition(orthogonalDestination, enemyPositions)) {
						filteredDestinations.capture.push(orthogonalDestination);
						break; // Stop at first enemy found along an orthogonal direction (and capture)
					} else if (
						includesPosition(orthogonalDestination, friendlyPositions)
					) {
						break; // Stop at first friend found along an orthogonal direction
					} else {
						filteredDestinations.move.push(orthogonalDestination);
						// Allow movement if no pieces are in the way
					}
				}
			}
		}

		return filteredDestinations;
	},

	cannon: ({
		destinations,
		friendlyPositions,
		enemyPositions,
		startFile,
		startRank,
	}) => {
		const filteredDestinations = {
			move: [],
			capture: [],
		};

		const movementVectors = [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		];

		// Looping through each direction (right, left, up, down)
		movementVectors.forEach((vector) => {
			let intermediatePiecePosition = [];
			const [fileVector, rankVector] = vector;

			for (let j = 1; j <= 9; ++j) {
				// Looping through 9 orthogonal steps

				const orthogonalDestination = [
					startFile + fileVector * j,
					startRank + rankVector * j,
				];

				if (includesPosition(orthogonalDestination, destinations)) {
					if (!intermediatePiecePosition.length) {
						// If no intermediate piece has been found yet

						if (
							includesPosition(orthogonalDestination, enemyPositions) ||
							includesPosition(orthogonalDestination, friendlyPositions)
						) {
							intermediatePiecePosition = orthogonalDestination; // First friend or enemy piece in orthogonal direction is assigned as intermediate piece
						} else {
							filteredDestinations.move.push(orthogonalDestination); // Allow movement if no pieces are in the way
						}
					} else {
						// If an intermediate piece has already been found

						if (includesPosition(orthogonalDestination, enemyPositions)) {
							filteredDestinations.capture.push(orthogonalDestination);
							break; // Allow capture on the next enemy piece found
						}
					}
				}
			}
		});

		return filteredDestinations;
	},
};
