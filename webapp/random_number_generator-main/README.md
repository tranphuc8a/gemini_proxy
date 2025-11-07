# Random Number Generator Tool

This is a standalone HTML tool that assigns random numbers to a list of names and displays them in a sorted list. It’s perfect for games, contests, team assignments, or any activity where you need to assign random numbers to participants.

---

## **Features**
- **Random Number Assignment**: Assigns a unique random number (between 1 and 100) to each name.
- **Sorted List**: Displays the names and their numbers in ascending order.
- **User-Friendly Interface**: Clean and intuitive design.
- **Delay Effect**: Displays names one by one with a 1-second delay for a dynamic experience.
- **Secure Randomness**: Uses `crypto.getRandomValues()` for cryptographically secure random numbers.

---

## **How to Use**
1. **Enter Names**:
   - Input a list of names, separated by commas, into the text box.
   - Example: `John, Alice, Bob, Emma`

2. **Generate Random Numbers**:
   - Click the "Start" button.
   - The tool will display each name with its random number, one by one, with a 1-second delay.

3. **View Sorted List**:
   - After all names are displayed, the tool will show a sorted list of names and their numbers in ascending order.


---

## **Files**
- **`index.html`**: The main HTML file for the tool.
- **`style.css`**: Contains the styling for the tool.
- **`script.js`**: Handles the logic for generating random numbers, displaying names, and sorting the list.

---

## **Customization**
- **Change the Range of Random Numbers**:
  - In `script.js`, modify the `getSecureRandomNumber(1, 100)` function to change the range of random numbers.
  - Example: Use `getSecureRandomNumber(50, 200)` for numbers between 50 and 200.

- **Update Styling**:
  - Edit the `style.css` file to customize the appearance of the tool.
  - Example: Change the background color, font, or button style.

- **Add More Features**:
  - Extend the functionality by modifying the `script.js` file.
  - Example: Add a feature to save the results as a file.

---

## **How to Run**
1. Download the files (`index.html`, `style.css`, `script.js`).
2. Open `index.html` in your web browser.
3. Start using the tool!

---

## **Security**
- **Input Sanitization**: The tool uses the `escapeHtml` function to sanitize user input and prevent XSS attacks.
- **Secure Randomness**: The tool uses `crypto.getRandomValues()` for cryptographically secure random numbers.

---

## **License**
This project is open-source and available under the [MIT License](LICENSE). Feel free to use, modify, and distribute it as needed.

---

## **Author**
Martin Gräbing
kontakt@duesseldorp.de
https://www.github.com/duesseldorp

---

Enjoy using the Random Number Generator Tool! 😊
