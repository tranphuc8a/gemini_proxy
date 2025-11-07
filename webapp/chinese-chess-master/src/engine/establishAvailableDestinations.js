import {
	definedPathsFilter,
	moveOrCaptureFilter,
	onBoardFilter,
} from "./destinationFilters";
import { movementRules } from "./movementRules";
import { nextTurnFilter } from "./nextTurnTests";

// Create Array of Available Destinations
// Level 3 Function
// Calls: onBoardFilter, definedPathsFilter, moveOrCaptureFilter
export const establishAvailableDestinations = ({
	boardState,
	pieceName,
	pieceSide,
	currentTurn,
	nextTurn,
}) => {
	// Lists properties of selected piece
	const {
		type: pieceType,
		currentPosition: [startFile, startRank],
	} = boardState.pieces[pieceSide][pieceName];
	const enemySide = pieceSide === "red" ? "black" : "red";
	const friendlyPositions = boardState.positions[pieceSide];
	const enemyPositions = boardState.positions[enemySide];

	const movementRulesDestinations = movementRules[pieceType]({
		allPositions: [...friendlyPositions, ...enemyPositions],
		pieceSide,
		startFile,
		startRank,
	});
	// Finds available destinations based on selected piece's movement rules

	const onBoardDestinations = onBoardFilter({
		destinations: movementRulesDestinations,
	});
	// Filters available destinations to those existing on the board

	const definedPathsDestinations = definedPathsFilter({
		destinations: onBoardDestinations,
		pieceType,
		pieceSide,
	});
	// Filters available destinations if selected piece has defined paths

	const moveOrCaptureDestinations =
		pieceType === "chariot" || pieceType === "cannon"
			? moveOrCaptureFilter[pieceType]({
					destinations: definedPathsDestinations,
					friendlyPositions,
					enemyPositions,
					startFile,
					startRank,
			  })
			: moveOrCaptureFilter.default({
					destinations: definedPathsDestinations,
					friendlyPositions,
					enemyPositions,
			  });

	return pieceSide === currentTurn
		? nextTurnFilter({
				destinations: moveOrCaptureDestinations,
				boardState,
				pieceName,
				pieceSide,
				currentTurn,
				nextTurn,
		  })
		: moveOrCaptureDestinations;
};

// Returns count of available moves and object of one side's pieces with updated available destinations
// Takes as parameter
export const establishPieceMovements = ({
	boardState,
	pieceSide,
	currentTurn,
	nextTurn,
}) => {
	boardState.status.availableMoves[pieceSide] = 0;

	let availableMoves = 0;
	let updatedSidePieces = {};

	for (let pieceName in boardState.pieces[pieceSide]) {
		updatedSidePieces[pieceName] = boardState.pieces[pieceSide][pieceName];

		updatedSidePieces[
			pieceName
		].availableDestinations = establishAvailableDestinations({
			boardState,
			pieceName,
			pieceSide,
			currentTurn,
			nextTurn,
		});

		availableMoves +=
			updatedSidePieces[pieceName].availableDestinations.move.length +
			updatedSidePieces[pieceName].availableDestinations.capture.length;
	}

	return [availableMoves, updatedSidePieces];
};
