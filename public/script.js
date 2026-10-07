const donorForm = document.getElementById('donorForm');
const searchInput = document.getElementById('searchInput');
const bloodFilter = document.getElementById('bloodFilter');
const donorTableBody = document.getElementById('donorTableBody');
const formMessage = document.getElementById('formMessage');
const totalDonorsEl = document.getElementById('totalDonors');
const availableDonorsEl = document.getElementById('availableDonors');
const unavailableDonorsEl = document.getElementById('unavailableDonors');

const socket = io();
let donorList = [];

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showMessage(message, type = 'success') {
  formMessage.textContent = message;
  formMessage.className = `message-box ${type}`;
}

function getFilteredDonors() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedGroup = bloodFilter.value;

  return donorList.filter((donor) => {
    const matchesSearch =
      !searchTerm ||
      donor.name.toLowerCase().includes(searchTerm) ||
      donor.phone.toLowerCase().includes(searchTerm) ||
      donor.city.toLowerCase().includes(searchTerm);

    const matchesGroup = selectedGroup === 'All' || donor.bloodGroup === selectedGroup;

    return matchesSearch && matchesGroup;
  });
}

function updateStatistics() {
  const total = donorList.length;
  const available = donorList.filter((donor) => donor.available).length;
  const unavailable = total - available;

  totalDonorsEl.textContent = total;
  availableDonorsEl.textContent = available;
  unavailableDonorsEl.textContent = unavailable;
}

function renderDonorTable() {
  const filteredDonors = getFilteredDonors();

  if (filteredDonors.length === 0) {
    donorTableBody.innerHTML = '<tr><td colspan="6" class="empty-row">No donors found.</td></tr>';
    return;
  }

  donorTableBody.innerHTML = filteredDonors
    .map(
      (donor) => `
        <tr>
          <td class="name-cell">${escapeHtml(donor.name)}</td>
          <td><span class="blood-badge">${escapeHtml(donor.bloodGroup)}</span></td>
          <td>${escapeHtml(donor.phone)}</td>
          <td>${escapeHtml(donor.city)}</td>
          <td>
            <span class="status-pill ${donor.available ? 'available' : 'unavailable'}">
              ${donor.available ? 'Available' : 'Not Available'}
            </span>
          </td>
          <td>
            <div class="action-group">
              <button class="action-btn" data-action="toggle" data-id="${donor._id}">Change Status</button>
              <button class="delete-btn" data-action="delete" data-id="${donor._id}">Delete</button>
            </div>
          </td>
        </tr>
      `
    )
    .join('');
}

async function fetchDonors() {
  try {
    const response = await fetch('/api/donors');
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Unable to load donors.');
    }

    donorList = data.donors || [];
    updateStatistics();
    renderDonorTable();
  } catch (error) {
    console.error('Error fetching donors:', error);
    showMessage('Unable to load donors. Please try again.', 'error');
  }
}

async function submitDonor(event) {
  event.preventDefault();

  const formData = new FormData(donorForm);
  const donorData = {
    name: formData.get('name').trim(),
    phone: formData.get('phone').trim(),
    bloodGroup: formData.get('bloodGroup').trim(),
    city: formData.get('city').trim(),
    available: formData.get('availability') === 'true',
  };

  try {
    const response = await fetch('/api/donors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(donorData),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Unable to register donor.');
    }

    donorForm.reset();
    document.getElementById('availability').value = 'true';
    showMessage('Donor registered successfully!', 'success');
    await fetchDonors();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function toggleDonorStatus(id) {
  const donor = donorList.find((item) => item._id === id);

  if (!donor) return;

  try {
    const response = await fetch(`/api/donors/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ available: !donor.available }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Unable to update donor status.');
    }

    await fetchDonors();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function deleteDonor(id) {
  const donor = donorList.find((item) => item._id === id);

  if (!donor) return;

  const confirmed = window.confirm(`Delete donor ${donor.name}?`);
  if (!confirmed) return;

  try {
    const response = await fetch(`/api/donors/${id}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Unable to delete donor.');
    }

    await fetchDonors();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

function attachActionHandlers() {
  donorTableBody.addEventListener('click', async (event) => {
    const target = event.target.closest('button');
    if (!target) return;

    const { action, id } = target.dataset;

    if (action === 'toggle') {
      await toggleDonorStatus(id);
    }

    if (action === 'delete') {
      await deleteDonor(id);
    }
  });
}

searchInput.addEventListener('input', renderDonorTable);
bloodFilter.addEventListener('change', renderDonorTable);
donorForm.addEventListener('submit', submitDonor);

socket.on('donor:created', (donor) => {
  donorList = [donor, ...donorList];
  updateStatistics();
  renderDonorTable();
});

socket.on('donor:updated', (updatedDonor) => {
  donorList = donorList.map((donor) => (donor._id === updatedDonor._id ? updatedDonor : donor));
  updateStatistics();
  renderDonorTable();
});

socket.on('donor:deleted', ({ id }) => {
  donorList = donorList.filter((donor) => donor._id !== id);
  updateStatistics();
  renderDonorTable();
});

attachActionHandlers();
fetchDonors();
