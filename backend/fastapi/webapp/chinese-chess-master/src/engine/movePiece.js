import { notateBoard, positionsBySide } from "./boardInitialization";
import { gameOverTest, checkTest } from "./boardTests";
import { establishPieceMovements } from "./establishAvailableDestinations";
import { includesPosition } from "./includesPosition";
import { deepCopyBoard, notatedToNumerical } from "./utils";

export const movePiece = ({
	boardState,
	selectedNotatedSource,
	selectedNotatedDestination,
}) => {
	// Return early if game over
	if (boardState.status.gameOver === true) return false;
	// Establish moving side
	const movingSide = boardState.status.currentTurn; // red

	// Destructure current and next turn
	const [currentTurn, nextTurn] = [
		boardState.status.currentTurn.slice(), // red
		boardState.status.nextTurn.slice(), // black
	];

	// Get piece name
	const pieceName = boardState.notatedBoard[selectedNotatedSource];

	// Retrieve available destinations
	const availableDestinations =
		boardState.pieces[movingSide][pieceName].availableDestinations;
	// Get numerical destination
	const selectedDestination = notatedToNumerical(selectedNotatedDestination);

	// If selected destination is not available, return early
	if (
		!includesPosition(selectedDestination, [
			...availableDestinations.move,
			...availableDestinations.capture,
		])
	)
		return false;
	// Otherwise, proceed with board change
	const newBoardState = deepCopyBoard(boardState);

	// Check to see if enemy piece exists at selected destination
	const capturedPieceName = boardState.notatedBoard[selectedNotatedDestination];

	if (capturedPieceName) {
		// Add the captured enemy piece to Captured Pieces object (enemy side is same as nextTurn)
		newBoardState.capturedPieces[nextTurn].push(capturedPieceName);

		// Remove the captured enemy piece from Pieces object
		delete newBoardState.pieces[nextTurn][capturedPieceName];
	}

	// Play out the selected movement
	newBoardState.pieces[currentTurn][
		pieceName
	].currentPosition = selectedDestination;

	newBoardState.pieces[currentTurn][
		pieceName
	].notatedPosition = selectedNotatedDestination;

	// Updated positions and notatedBoard
	newBoardState.positions = positionsBySide(newBoardState.pieces);
	newBoardState.notatedBoard = notateBoard(newBoardState.pieces);

	// Switch currentTurn and nextTurn (change the sides)
	newBoardState.status.currentTurn = nextTurn; // black
	newBoardState.status.nextTurn = currentTurn; // red

	// Destructure new current run and next turn
	const [newCurrentTurn, newNextTurn] = [
		newBoardState.status.currentTurn.slice(),
		newBoardState.status.nextTurn.slice(),
	]; // black, red

	// Increase turn count
	newBoardState.status.turnNumber++;

	[
		newBoardState.status.availableMoves[movingSide],
		newBoardState.pieces[movingSide],
	] = establishPieceMovements({
		boardState: newBoardState,
		pieceSide: movingSide, // red
		currentTurn: newCurrentTurn,
		nextTurn: newNextTurn,
	});

	[
		newBoardState.status.availableMoves[newCurrentTurn],
		newBoardState.pieces[newCurrentTurn],
	] = establishPieceMovements({
		boardState: newBoardState,
		pieceSide: newCurrentTurn, // black
		currentTurn: newCurrentTurn,
		nextTurn: newNextTurn,
	});

	if (newBoardState.status.turnNumber > 0) {
		newBoardState.status.check[newNextTurn] = checkTest({
			boardState: newBoardState,
			friendlySide: newNextTurn,
			enemySide: newCurrentTurn,
		});
		newBoardState.status.check[newCurrentTurn] = checkTest({
			boardState: newBoardState,
			friendlySide: newCurrentTurn,
			enemySide: newNextTurn,
		});
	}

	newBoardState.status.gameOver = gameOverTest(newBoardState, newCurrentTurn);

	return newBoardState;
};
