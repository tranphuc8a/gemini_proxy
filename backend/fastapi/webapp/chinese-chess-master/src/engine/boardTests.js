// Test for Flying Generals

import { includesPosition } from "./includesPosition";

// Level 1 Function
export const flyingGeneralTest = (boardState) => {
	// Get positions of the two generals
	const general_redPosition = boardState.pieces.red.general_red.currentPosition;
	const general_blackPosition =
		boardState.pieces.black.general_black.currentPosition;

	if (general_redPosition[0] !== general_blackPosition[0]) {
		return false; // If the two generals are not on the same file, move on
	} else {
		const fileNotation = "abcdefghi";
		const generalsFile = fileNotation[general_redPosition[0]];

		// Loop through each rank and look for pieces between the generals
		for (
			let i = general_redPosition[1] + 1;
			i < general_blackPosition[1];
			++i
		) {
			const selectedPosition = String(generalsFile + i);

			if (boardState.notatedBoard[selectedPosition]) {
				return false;
			}
		}
	}

	return true; // Return true if generals face each other directly
};

// Detect if Check Has Occurred
export const checkTest = ({ boardState, friendlySide, enemySide }) => {
	const generalPositions = {
		red: boardState.pieces.red.general_red.currentPosition,
		black: boardState.pieces.black.general_black.currentPosition,
	};

	// Create object containing check info
	const checkState = {
		inCheck: false,
		checkingPieces: [],
	};

	// Loop through pieces on checkingSide
	for (let piece in boardState.pieces[enemySide]) {
		const selectedPieceCapture =
			boardState.pieces[enemySide][piece].availableDestinations.capture;

		// If the piece's available captures include the enemy general, set check to true
		if (
			includesPosition(generalPositions[friendlySide], selectedPieceCapture)
		) {
			checkState.inCheck = true;
			checkState.checkingPieces.push(piece);
		}
	}

	return checkState;
};

export const drawTest = (boardState) => {
	if (boardState.status.turnNumber >= 120) return true;

	const piecesList = Object.values(boardState.notatedBoard).map(
		(piece) => piece.split("_")[0]
	);

	if (piecesList.length === 2) return true; // only generals left
	if (
		!piecesList.includes("chariot") &&
		!piecesList.includes("horse") &&
		!piecesList.includes("cannon") &&
		!piecesList.includes("soldier")
	)
		// remaining pieces insufficient for checkmate/stalemate
		return true;

	return false;
};

export const gameOverTest = (boardState, checkedSide) => {
	if (drawTest(boardState)) return "draw";

	const inCheck = boardState.status.check[checkedSide].inCheck;
	const availableMoves = boardState.status.availableMoves[checkedSide];

	if (!availableMoves) {
		if (inCheck) return "checkmate";
		else return "stalemate";
	} else return false;
};
