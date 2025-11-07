import "./css/xiangqiboard-0.2.0.css";
import $ from "./jquery-3.4.1.js";
import "./xiangqiboard-0.2.0.js";
import { defaultPositions } from "./engine/boardSetup";
import { newGame } from "./engine/boardInitialization";
import { movePiece } from "./engine/movePiece";

let board = null;
let game = newGame(defaultPositions);
let $status = $("#status");

const onDragStart = (source, piece, position, orientation) => {
	// do not pick up pieces if the game is over
	if (game.status.gameOver) {
		return false;
	}

	// only pick up pieces for the side to move
	if (
		(game.status.currentTurn === "red" && piece.search(/^b/) !== -1) ||
		(game.status.currentTurn === "black" && piece.search(/^r/) !== -1)
	) {
		return false;
	}
};

const onDrop = (source, target) => {
	// see if the move is legal
	let move = movePiece({
		boardState: game,
		selectedNotatedSource: source,
		selectedNotatedDestination: target,
	});
	// illegal move
	if (!move) return "snapback";

	game = move;
	updateStatus();
};

// board config
let config = {
	draggable: true,
	position: "start",
	onDragStart: onDragStart,
	onDrop: onDrop,
};

board = Xiangqiboard("myBoard", config);

const updateStatus = () => {
	let status = "";

	let moveColor = game.status.currentTurn;

	// draw, checkmate, or stalemate?
	if (game.status.gameOver) {
		if (game.status.gameOver === "draw") {
			status = "Game over, drawn position";
		} else {
			status = `Game over, ${moveColor} is in ${game.status.gameOver}.`;
		}
	}

	// game still on
	else {
		status = moveColor + " to move";

		// check?
		if (game.status.check[moveColor].inCheck) {
			status += ", " + moveColor + " is in check";
		}
	}

	$status.html(status);
};

updateStatus();
