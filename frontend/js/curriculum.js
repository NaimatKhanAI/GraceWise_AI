// Curriculum Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Set current date
    const currentDateElement = document.getElementById('current-date');
    if (currentDateElement) {
        const today = new Date();
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        };
        currentDateElement.textContent = today.toLocaleDateString('en-US', options);
    }

    // Subject tabs functionality
    const subjectTabs = document.querySelectorAll('.subject-tab');
    subjectTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            subjectTabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Filter curriculum sections based on selected subject
            filterCurriculumSections(this.textContent.trim());
        });
    });

    // Expand/Collapse sections
    const expandButtons = document.querySelectorAll('.expand-btn');
    expandButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const section = this.closest('.curriculum-section');
            const modulesList = section.querySelector('.modules-list');
            const addModuleBtn = section.querySelector('.add-module');
            
            if (modulesList.style.display === 'none') {
                modulesList.style.display = 'block';
                addModuleBtn.style.display = 'flex';
                this.innerHTML = '<i class="fas fa-chevron-down"></i>';
            } else {
                modulesList.style.display = 'none';
                addModuleBtn.style.display = 'none';
                this.innerHTML = '<i class="fas fa-chevron-right"></i>';
            }
        });
    });

    // Section header click to expand/collapse
    const sectionHeaders = document.querySelectorAll('.section-header');
    sectionHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const expandBtn = this.querySelector('.expand-btn');
            if (expandBtn) {
                expandBtn.click();
            }
        });
    });

    // Module menu functionality
    const moduleMenus = document.querySelectorAll('.module-menu');
    moduleMenus.forEach(menu => {
        menu.addEventListener('click', function(e) {
            e.stopPropagation();
            // Add dropdown menu functionality here
            console.log('Module menu clicked');
        });
    });

    // Add module button functionality
    const addModuleBtns = document.querySelectorAll('.add-module');
    addModuleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Add new module functionality here
            console.log('Add module clicked');
        });
    });

    // Add new module button (main)
    const addNewModuleBtn = document.querySelector('.add-module-btn');
    if (addNewModuleBtn) {
        addNewModuleBtn.addEventListener('click', function() {
            // Add new module functionality here
            console.log('Add new module clicked');
        });
    }

    // Filter functionality
    const filterSelects = document.querySelectorAll('.filter-select');
    filterSelects.forEach(select => {
        select.addEventListener('change', function() {
            // Filter functionality here
            console.log('Filter changed:', this.value);
        });
    });
});

// Filter curriculum sections based on subject
function filterCurriculumSections(subject) {
    const sections = document.querySelectorAll('.curriculum-section');
    
    if (subject === 'All Subjects') {
        sections.forEach(section => {
            section.style.display = 'block';
        });
    } else {
        sections.forEach(section => {
            const sectionTitle = section.querySelector('.section-details h3').textContent;
            if (sectionTitle.toLowerCase().includes(subject.toLowerCase())) {
                section.style.display = 'block';
            } else {
                section.style.display = 'none';
            }
        });
    }
}

// Search functionality
const searchInput = document.querySelector('.search-bar input');
if (searchInput) {
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const sections = document.querySelectorAll('.curriculum-section');
        
        sections.forEach(section => {
            const sectionTitle = section.querySelector('.section-details h3').textContent.toLowerCase();
            const modules = section.querySelectorAll('.module-item');
            let hasVisibleModule = false;
            
            modules.forEach(module => {
                const moduleTitle = module.querySelector('.module-content h4').textContent.toLowerCase();
                if (moduleTitle.includes(searchTerm) || sectionTitle.includes(searchTerm)) {
                    module.style.display = 'flex';
                    hasVisibleModule = true;
                } else {
                    module.style.display = 'none';
                }
            });
            
            if (hasVisibleModule || sectionTitle.includes(searchTerm)) {
                section.style.display = 'block';
            } else {
                section.style.display = 'none';
            }
        });
    });
}