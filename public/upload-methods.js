/**
 * Handle upload method selection and form switching
 */
document.addEventListener('DOMContentLoaded', () => {
    // Handle upload method selection
    document.querySelectorAll('.method-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const method = this.getAttribute('data-method');
            document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            document.getElementById('uploadForm').style.display = method === 'traditional' ? 'block' : 'none';
            document.getElementById('resumableForm').style.display = method === 'resumable' ? 'block' : 'none';
        });
    });

    // Sync facility selection between forms
    document.getElementById('facility_name').addEventListener('change', function() {
        document.getElementById('resumable_facility_name').value = this.value;
        const selectedOption = this.options[this.selectedIndex];
        const facilityCode = selectedOption.getAttribute('data-code');
        document.getElementById('facility_code').value = facilityCode || '';
        document.getElementById('resumable_facility_code').value = facilityCode || '';
    });

    document.getElementById('resumable_facility_name').addEventListener('change', function() {
        document.getElementById('facility_name').value = this.value;
        const selectedOption = this.options[this.selectedIndex];
        const facilityCode = selectedOption.getAttribute('data-code');
        document.getElementById('resumable_facility_code').value = facilityCode || '';
        document.getElementById('facility_code').value = facilityCode || '';
    });
});
