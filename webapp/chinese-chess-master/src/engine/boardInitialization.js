import { notationPiece } from "./boardSetup";
import { establishPieceMovements } from "./establishAvailableDestinations";
import { numericalToNotated } from "./utils";

// Initialize Board
// Calls: populateBoard, positionsBySide, notateBoard
export const newGame = (startingPositions) => {
	const [currentTurn, nextTurn] = ["red", "black"];
	const boardState = {
		pieces: {
			red: {},
			black: {},
		},
		positions: {
			red: [],
			black: [],
		},
		capturedPieces: {
			red: [],
			black: [],
		},
		status: {
			currentTurn: currentTurn,
			nextTurn: nextTurn,
			turnNumber: 0,
			check: {
				red: {
					inCheck: false,
					checkingPieces: [],
				},
				black: {
					inCheck: false,
					checkingPieces: [],
				},
			},
			gameOver: false,
			availableMoves: {
				red: 0,
				black: 0,
			},
		},
		notatedBoard: {},
	};
	boardState.pieces = populateBoard(startingPositions);
	boardState.positions = positionsBySide(boardState.pieces);
	boardState.notatedBoard = notateBoard(boardState.pieces);

	[
		boardState.status.availableMoves[currentTurn],
		boardState.pieces[currentTurn],
	] = establishPieceMovements({
		boardState,
		pieceSide: currentTurn,
		currentTurn,
		nextTurn,
	});
	return boardState;
};

// Populate Board.Pieces Object with Pieces: Type, Side, Starting Position
// Input: Positions Object
const populateBoard = (allPositions) => {
	const pieces = {
		red: {},
		black: {},
	};

	for (let i = 0; i < Object.keys(allPositions).length; ++i) {
		// Loop through each piece in Positions Object

		const selectedPiece = Object.keys(allPositions)[i]; // 'chariot_red_left'
		const [selectedPieceType, selectedPieceSide] = selectedPiece.split("_"); // ['chariot', 'red', 'left']
		const selectedNotationType = notationPiece[selectedPieceType];
		const selectedNotationSide = selectedPieceSide[0];

		// Create object with piece name as key and type and currentPosition information

		const [file, rank] = allPositions[selectedPiece];

		pieces[selectedPieceSide][selectedPiece] = {
			type: selectedPieceType,
			notation: selectedNotationSide + selectedNotationType,
			currentPosition: [file, rank],
			notatedPosition: numericalToNotated([file, rank]),
		};
	}

	return pieces; // Create Pieces Object
};

// Create Obj of Positions By Side
export const positionsBySide = (pieces) => {
	// Organize positions by side
	return {
		red: Object.keys(pieces.red).map(
			(piece) => pieces.red[piece].currentPosition
		),
		black: Object.keys(pieces.black).map(
			(piece) => pieces.black[piece].currentPosition
		),
	};
};

// Notate Board
export const notateBoard = (pieces) => {
	const notatedBoard = {};

	// Create object with notated positions as keys and pieces as values
	for (let side in pieces) {
		for (let piece in pieces[side]) {
			notatedBoard[pieces[side][piece].notatedPosition] = piece;
		}
	}

	return notatedBoard;
};
