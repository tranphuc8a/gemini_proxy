import { notateBoard, positionsBySide } from "./boardInitialization";
import { checkTest, flyingGeneralTest } from "./boardTests";
import { establishPieceMovements } from "./establishAvailableDestinations";
import { deepCopyBoard, numericalToNotated } from "./utils";

// Filters moves based on results of next turn model
export const nextTurnFilter = ({
	destinations,
	boardState,
	pieceName,
	pieceSide,
	currentTurn,
	nextTurn,
}) => {
	// Filter available 'move' destinations for selected piece
	const move = destinations.move.filter((selectedDestination) =>
		nextTurnModel({
			boardState,
			pieceName,
			pieceSide,
			selectedDestination,
			currentTurn,
			nextTurn,
		})
	);

	// Filter available 'capture' destinations for selected piece
	const capture = destinations.capture.filter((selectedDestination) =>
		nextTurnModel({
			boardState,
			pieceName,
			pieceSide,
			selectedDestination,
			currentTurn,
			nextTurn,
		})
	);

	return { move, capture };
};

// Models board state for next turn, return boolean based on possible state or not
export const nextTurnModel = ({
	boardState,
	pieceName,
	pieceSide,
	selectedDestination,
	currentTurn,
	nextTurn,
}) => {
	const nextBoardState = deepCopyBoard(boardState); // Create hypothetical board
	const selectedNotatedDestination = numericalToNotated(selectedDestination); // Get notated destination

	const capturedPieceName =
		nextBoardState.notatedBoard[selectedNotatedDestination];

	if (capturedPieceName) {
		// If selected move is a capture

		nextBoardState.capturedPieces[nextTurn].push(capturedPieceName); // Add the captured enemy piece to Captured Pieces object (enemy side is same as nextTurn)

		delete nextBoardState.pieces[nextTurn][capturedPieceName]; // Remove the captured enemy piece from Pieces object
	}

	nextBoardState.pieces[pieceSide][
		pieceName
	].currentPosition = selectedDestination;

	nextBoardState.pieces[currentTurn][
		pieceName
	].notatedPosition = selectedNotatedDestination;
	// Play out the selected movement

	nextBoardState.positions = positionsBySide(nextBoardState.pieces); // List positions for new board
	nextBoardState.notatedBoard = notateBoard(nextBoardState.pieces); // Notates new board

	if (flyingGeneralTest(nextBoardState)) return false; // If flying generals are exposed, immediately skip to next available move

	[
		nextBoardState.status.availableMoves[nextTurn],
		nextBoardState.pieces[nextTurn],
	] = establishPieceMovements({
		boardState: nextBoardState,
		pieceSide: nextTurn,
		currentTurn,
		nextTurn,
	});

	/*
  for (let piece in nextBoardState.pieces[nextTurn]) { // Establish available moves for enemy pieces

    const selectedPiece = nextBoardState.pieces[nextTurn][piece]

    selectedPiece.availableDestinations = establishAvailableDestinations(nextBoardState, piece, nextTurn, currentTurn, nextTurn) // NextTurnTest will not occur here because piecesSide does not match currentTurn
  }
  */

	if (
		checkTest({
			boardState: nextBoardState,
			friendlySide: currentTurn,
			enemySide: nextTurn,
		}).inCheck
	)
		return false;
	// Run check function, return false if currentTurn side is checked

	return true;
};
