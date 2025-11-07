document.getElementById('name-form').addEventListener('submit', function (e) {
    e.preventDefault();

    // Clear previous results
    document.getElementById('output').innerHTML = '';
    document.getElementById('sorted-list').innerHTML = '';

    // Get names from the textarea
    const namesInput = document.getElementById('names').value.trim();
    if (!namesInput) {
        alert('Please enter at least one name.');
        return;
    }

    // Validate input (alphanumeric and commas only)
    const validInput = /^[a-zA-Z0-9\s,]+$/.test(namesInput);
    if (!validInput) {
        alert('Invalid input. Only letters, numbers, and commas are allowed.');
        return;
    }

    // Split names and sanitize
    const names = namesInput.split(',').map(name => escapeHtml(name.trim()));
    const results = [];

    // Function to generate a cryptographically secure random number
    function getSecureRandomNumber(min, max) {
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array); // Fill the array with random values
        return min + (array[0] % (max - min + 1)); // Scale to the desired range
    }

    // Function to display names with random numbers one by one
    function displayNames(index) {
        if (index < names.length) {
            const randomNumber = getSecureRandomNumber(1, 100); // Random number between 1 and 100
            results.push({ name: names[index], number: randomNumber });

            // Display the current name and number (escaped for security)
            const outputDiv = document.getElementById('output');
            outputDiv.innerHTML += `<p>${names[index]}: ${randomNumber}</p>`;

            // Delay before showing the next name
            setTimeout(() => displayNames(index + 1), 1000); // 1-second delay
        } else {
            // Sort the results by number in ascending order
            results.sort((a, b) => a.number - b.number);

            // Display the sorted list with numbers (1-n) before each name
            const sortedListDiv = document.getElementById('sorted-list');
            let sortedListHTML = '<h3>Sorted List:</h3>';
            results.forEach((item, index) => {
                sortedListHTML += `<p><strong>${index + 1}.</strong> ${item.name}: ${item.number}</p>`;
            });
            sortedListDiv.innerHTML = sortedListHTML;
        }
    }

    // Start the process
    displayNames(0);
});

// Function to escape HTML
function escapeHtml(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}