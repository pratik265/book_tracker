// Google Identity Services Sign-In Handler
function handleCredentialResponse(response) {
    // This is where you handle the JWT token from Google
    console.log("Encoded JWT ID token: ", response.credential);
    showSyncStatus('Signed in with Google!', 'success');
    // You can decode the token and get user info here if needed
}

// Google Drive API Configuration
// const CLIENT_ID = "1017720485305-82919ut9v40ci7t4siskhgijer1t930h.apps.googleusercontent.com";
// const API_KEY = '';
// const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
// const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// let GoogleAuth;
// let isSignedIn = false;

// Google Drive API Functions
function updateSigninStatus(isSignedInNow) {
    // isSignedIn = isSignedInNow;
    document.getElementById('signin-button').style.display = isSignedInNow ? 'none' : 'block';
    document.getElementById('sync-button').style.display = isSignedInNow ? 'inline-block' : 'none';
    document.getElementById('load-button').style.display = isSignedInNow ? 'inline-block' : 'none';
}

function handleClientLoad() {
    // gapi.load('client:auth2', initClient);
}

function initClient() {
    // gapi.client.init({
    //     apiKey: API_KEY,
    //     clientId: CLIENT_ID,
    //     discoveryDocs: DISCOVERY_DOCS,
    //     scope: SCOPES
    // }).then(() => {
    //     GoogleAuth = gapi.auth2.getAuthInstance();
    //     updateSigninStatus(GoogleAuth.isSignedIn.get());
    //     GoogleAuth.isSignedIn.listen(updateSigninStatus);
    //     
    //     // Set up button event listeners
    //     document.getElementById('signin-button').onclick = () => GoogleAuth.signIn();
    //     document.getElementById('sync-button').onclick = syncBooksToDrive;
    //     document.getElementById('load-button').onclick = loadBooksFromDrive;
    //     
    //     // Auto-load books from Drive if signed in
    //     if (GoogleAuth.isSignedIn.get()) {
    //         loadBooksFromDrive();
    //     }
    // }).catch(error => {
    //     console.error('Error initializing Google API:', error);
    //     showSyncStatus('Error initializing Google API. Please check your Client ID.', 'error');
    // });
}

function showSyncStatus(message, type = 'success') {
    const statusDiv = document.getElementById('sync-status');
    statusDiv.textContent = message;
    statusDiv.className = `sync-status ${type}`;
    
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'sync-status';
        }, 3000);
    }
}

// Sync LocalStorage data to Google Drive
function syncBooksToDrive() {
    showSyncStatus('Syncing to Google Drive...', 'loading');
    
    const booksData = {
        books: JSON.parse(localStorage.getItem('books')) || [],
        pdfData: JSON.parse(localStorage.getItem('pdfData')) || {},
        lastSync: new Date().toISOString()
    };
    
    const content = JSON.stringify(booksData, null, 2);
    
    // Check if file already exists
    gapi.client.drive.files.list({
        'q': "name='book_tracker_data.json' and trashed=false",
        'fields': "files(id, name)"
    }).then(function(response) {
        const files = response.result.files;
        if (files && files.length > 0) {
            // Update existing file
            const fileId = files[0].id;
            updateDriveFile(fileId, content);
        } else {
            // Create new file
            createDriveFile(content);
        }
    }).catch(error => {
        console.error('Error syncing to Drive:', error);
        showSyncStatus('Error syncing to Google Drive. Please try again.', 'error');
    });
}

function createDriveFile(content) {
    const file = new Blob([content], {type: 'application/json'});
    const metadata = {
        'name': 'book_tracker_data.json',
        'mimeType': 'application/json'
    };
    
    var accessToken = gapi.auth.getToken().access_token;
    fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({'Authorization': 'Bearer ' + accessToken}),
        body: buildMultipartRequestBody(metadata, file)
    }).then(response => response.json())
      .then(val => {
          showSyncStatus('Books successfully synced to Google Drive!', 'success');
      })
      .catch(error => {
          console.error('Error creating file:', error);
          showSyncStatus('Error creating file in Google Drive.', 'error');
      });
}

function updateDriveFile(fileId, content) {
    var accessToken = gapi.auth.getToken().access_token;
    fetch('https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media', {
        method: 'PATCH',
        headers: new Headers({
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json'
        }),
        body: content
    }).then(response => response.json())
      .then(val => {
          showSyncStatus('Books successfully updated in Google Drive!', 'success');
      })
      .catch(error => {
          console.error('Error updating file:', error);
          showSyncStatus('Error updating file in Google Drive.', 'error');
      });
}

// Load books from Google Drive
function loadBooksFromDrive() {
    showSyncStatus('Loading from Google Drive...', 'loading');
    
    gapi.client.drive.files.list({
        'q': "name='book_tracker_data.json' and trashed=false",
        'fields': "files(id, name)"
    }).then(function(response) {
        const files = response.result.files;
        if (files && files.length > 0) {
            const fileId = files[0].id;
            downloadDriveFile(fileId);
        } else {
            showSyncStatus('No saved data found in Google Drive.', 'error');
        }
    }).catch(error => {
        console.error('Error loading from Drive:', error);
        showSyncStatus('Error loading from Google Drive.', 'error');
    });
}

function downloadDriveFile(fileId) {
    var accessToken = gapi.auth.getToken().access_token;
    fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: new Headers({'Authorization': 'Bearer ' + accessToken})
    }).then(response => response.json())
      .then(data => {
          // Load the data into LocalStorage
          if (data.books) {
              localStorage.setItem('books', JSON.stringify(data.books));
          }
          if (data.pdfData) {
              localStorage.setItem('pdfData', JSON.stringify(data.pdfData));
          }
          
          // Reload the books display
          loadBooksFromLocalStorage();
          renderBooks();
          
          showSyncStatus('Books successfully loaded from Google Drive!', 'success');
      })
      .catch(error => {
          console.error('Error downloading file:', error);
          showSyncStatus('Error downloading file from Google Drive.', 'error');
      });
}

function buildMultipartRequestBody(metadata, fileData) {
    var boundary = '-------314159265358979323846';
    var delimiter = "\r\n--" + boundary + "\r\n";
    var close_delim = "\r\n--" + boundary + "--";
    
    return [
        delimiter,
        'Content-Type: application/json\r\n\r\n',
        JSON.stringify(metadata),
        delimiter,
        'Content-Type: application/json\r\n\r\n',
        fileData,
        close_delim
    ].join('');
}

// Main Application Code
document.addEventListener('DOMContentLoaded', () => {
    const addBookForm = document.getElementById('add-book-form');
    const bookList = document.getElementById('book-list');
    let books = [];
    let pdfData = {};

    function loadBooksFromLocalStorage() {
        books = JSON.parse(localStorage.getItem('books')) || [];
        pdfData = JSON.parse(localStorage.getItem('pdfData')) || {};
    }

    function saveBooks() {
        localStorage.setItem('books', JSON.stringify(books));
    }

    function savePdfData() {
        localStorage.setItem('pdfData', JSON.stringify(pdfData));
    }

    function renderBooks() {
        bookList.innerHTML = '';
        books.forEach((book, index) => {
            const bookItem = document.createElement('li');
            bookItem.className = 'book-item';
            bookItem.innerHTML = `
                <div class="info">
                    <strong>${book.name}</strong> by ${book.author}<br>
                    <small>
                        Pages: ${book.pagesRead} / ${book.totalPages} | 
                        Started: ${book.startDate} | 
                        ${book.endDate ? `Finished: ${book.endDate}` : 'In Progress'}
                    </small>
                </div>
                <div class="actions">
                    <input type="number" class="pages-read" data-index="${index}" value="${book.pagesRead}" min="0" max="${book.totalPages}">
                    <button class="update-btn" data-index="${index}">Update</button>
                    ${pdfData[book.id] ? `<button class="view-pdf-btn" data-id="${book.id}">View PDF</button>` : ''}
                    <button class="delete-btn" data-index="${index}">Delete</button>
                </div>
            `;
            bookList.appendChild(bookItem);
        });
    }

    addBookForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const bookName = document.getElementById('book-name').value;
        const authorName = document.getElementById('author-name').value;
        const totalPages = document.getElementById('total-pages').value;
        const startDate = document.getElementById('start-date').value;
        const bookPdfFile = document.getElementById('book-pdf').files[0];

        const bookId = Date.now();

        const newBook = {
            id: bookId,
            name: bookName,
            author: authorName,
            totalPages: parseInt(totalPages),
            pagesRead: 0,
            startDate: startDate,
            endDate: null,
        };

        if (bookPdfFile) {
            const reader = new FileReader();
            reader.onload = function(event) {
                pdfData[bookId] = event.target.result;
                savePdfData();
                books.push(newBook);
                saveBooks();
                renderBooks();
                addBookForm.reset();
            };
            reader.readAsDataURL(bookPdfFile);
        } else {
            books.push(newBook);
            saveBooks();
            renderBooks();
            addBookForm.reset();
        }
    });

    bookList.addEventListener('click', (e) => {
        const index = e.target.dataset.index;

        if (e.target.classList.contains('delete-btn')) {
            const bookId = books[index].id;
            delete pdfData[bookId];
            books.splice(index, 1);
            savePdfData();
            saveBooks();
            renderBooks();
        }

        if (e.target.classList.contains('update-btn')) {
            const pagesReadInput = document.querySelector(`.pages-read[data-index='${index}']`);
            const pagesRead = parseInt(pagesReadInput.value);
            books[index].pagesRead = pagesRead;

            if (pagesRead >= books[index].totalPages) {
                books[index].endDate = new Date().toISOString().split('T')[0];
            } else {
                books[index].endDate = null;
            }

            saveBooks();
            renderBooks();
        }

        if (e.target.classList.contains('view-pdf-btn')) {
            const bookId = e.target.dataset.id;
            const pdfUrl = pdfData[bookId];
            if (pdfUrl) {
                window.open(pdfUrl, '_blank');
            }
        }
    });

    // Initialize the app
    loadBooksFromLocalStorage();
    renderBooks();
}); 