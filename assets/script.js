document.addEventListener('DOMContentLoaded', () => {
    const card = document.querySelector('.glass-card');
    const viewTeamBtn = document.getElementById('view-team-btn');
    const teamModal = document.getElementById('team-modal');
    const backBtn = document.getElementById('back-btn');

    if (card) {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -5; // Max rotation 5 degrees
            const rotateY = ((x - centerX) / centerX) * 5;  // Max rotation 5 degrees

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1, 1, 1)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
        });
    }

    const openModal = () => teamModal.classList.add('visible');
    const closeModal = () => teamModal.classList.remove('visible');

    if (viewTeamBtn && teamModal) {
        viewTeamBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', closeModal);
    }

    if (teamModal) {
        teamModal.addEventListener('click', (e) => {
            if (e.target === teamModal) {
                closeModal();
            }
        });
    }
});