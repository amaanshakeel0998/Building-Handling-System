let buildings = [];
let scene, camera, renderer, controls;
let generated = false;

const inputView = document.getElementById('input-view');
const view3D = document.getElementById('view-3d');
const container = document.getElementById('container');
const loadingBar = document.getElementById('loading-bar');
const loadingText = document.getElementById('loading-text');
const loadingProgress = document.getElementById('loading-progress');

// Save instantly to browser localStorage
function saveToLocal() {
    try {
        localStorage.setItem('buildingsData', JSON.stringify(buildings));
        console.log("Saved to localStorage");
    } catch (err) {
        console.error("Local save failed:", err);
        alert("Save failed — browser storage might be full");
    }
}

// Load from localStorage
function loadFromLocal() {
    try {
        const saved = localStorage.getItem('buildingsData');
        if (saved) {
            buildings = JSON.parse(saved);
            console.log("Loaded from localStorage:", buildings.length, "buildings");
            return true;
        } else {
            console.log("No saved data yet");
            return false;
        }
    } catch (err) {
        console.error("Local load failed:", err);
        return false;
    }
}

window.addEventListener('load', () => {
    console.log("App starting – local mode (no Firebase)");

    const loaded = loadFromLocal();
    if (loaded) {
        rebuildUIFromData();
    } else {
        buildings = [];
    }

    attachDeleteListeners();
    setInterval(checkAndExpireBookings, 30000);
    checkAndExpireBookings();

    console.log("Ready! Setup buildings → add floors → generate 3D");
});

// Navigation between views
document.querySelectorAll('.sidebar .nav-link').forEach(link => {
    link.addEventListener('click', e => {
        if (link.dataset.view) {
            e.preventDefault();
            document.querySelectorAll('.sidebar .nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const isView = link.dataset.view === 'view';

            inputView.style.display = !isView ? 'block' : 'none';
            view3D.style.display = isView ? 'block' : 'none';

            if (isView && buildings.length > 0) {
                if (!generated) {
                    generate3DBuildings();
                } else {
                    if (renderer && container.children.length === 0) {
                        container.appendChild(renderer.domElement);
                    }
                    controls.update();
                }
            }
        }
    });
});

// Setup number of buildings
document.getElementById('setup-buildings').addEventListener('click', () => {
    const num = parseInt(document.getElementById('num-buildings').value);
    if (isNaN(num) || num < 1 || num > 10) return alert("Please enter 1-10 buildings only");

    const currentNum = buildings.length;
    if (num <= currentNum) return alert("Enter a number greater than current buildings to add more.");

    const selectBuilding = document.getElementById('select-building');
    const selectBuildingForFloors = document.getElementById('select-building-for-floors');
    const roomSelectBuilding = document.getElementById('room-select-building');

    for (let i = currentNum + 1; i <= num; i++) {
        buildings.push({ name: `Building ${i}`, floors: [] });
        document.getElementById('configured-buildings').innerHTML += `<div class="configured-item">🏢 Building ${i}</div>`;
    }

    selectBuilding.innerHTML = '';
    selectBuildingForFloors.innerHTML = '';
    roomSelectBuilding.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '-- Select Building --';
    selectBuilding.appendChild(placeholder.cloneNode(true));
    selectBuildingForFloors.appendChild(placeholder.cloneNode(true));
    roomSelectBuilding.appendChild(placeholder.cloneNode(true));

    for (let i = 0; i < buildings.length; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = buildings[i].name;
        selectBuilding.appendChild(opt.cloneNode(true));
        selectBuildingForFloors.appendChild(opt.cloneNode(true));
        roomSelectBuilding.appendChild(opt);
    }

    selectBuilding.disabled = false;
    document.getElementById('add-name').disabled = false;
    selectBuildingForFloors.disabled = false;
    roomSelectBuilding.disabled = false;
});

// Add custom building name
document.getElementById('add-name').addEventListener('click', () => {
    const idx = parseInt(document.getElementById('select-building').value);
    const name = document.getElementById('building-name').value.trim();
    if (isNaN(idx) || !name) return alert("Select a building and enter a name");

    buildings[idx].name = name;
    document.getElementById('named-buildings').innerHTML += `
        <div class="configured-item" id="named-item-${idx}">
            ✅ ${name}
            <span class="remove-name ms-2 text-danger" style="cursor:pointer; font-size:1.2em;" data-building="${idx}">🗑️</span>
        </div>`;
    document.getElementById('select-building').options[idx + 1].textContent = name;
    document.getElementById('select-building-for-floors').options[idx + 1].textContent = name;
    document.getElementById('room-select-building').options[idx + 1].textContent = name;
    document.getElementById('building-name').value = '';
});

// Add floors to building
document.getElementById('add-floors').addEventListener('click', () => {
    const buildingIdx = parseInt(document.getElementById('select-building-for-floors').value);
    const num = parseInt(document.getElementById('num-floors').value);
    if (isNaN(num) || num < 1 || isNaN(buildingIdx)) return alert("Select building and enter valid number of floors");

    const names = ['Ground','First','Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth','Ninth','Tenth','Eleventh','Twelfth','Thirteenth','Fourteenth','Fifteenth','Sixteenth','Seventeenth','Eighteenth','Nineteenth','Twentieth'];
    const currentFloors = buildings[buildingIdx].floors.length;

    if (num < currentFloors) {
        buildings[buildingIdx].floors = buildings[buildingIdx].floors.slice(0, num);
    } else if (num > currentFloors) {
        for (let i = 1; i <= num - currentFloors; i++) {
            const floorNum = currentFloors + i;
            const floorName = names[floorNum - 1] || floorNum + 'th';
            buildings[buildingIdx].floors.push({ name: floorName, rooms: [] });
        }
    }

    document.getElementById('configured-floors').innerHTML = '';
    buildings[buildingIdx].floors.forEach(floor => {
        document.getElementById('configured-floors').innerHTML += `<div class="configured-item">📶 ${buildings[buildingIdx].name} - ${floor.name} Floor</div>`;
    });
    document.getElementById('num-floors').value = '';

    const roomSelectBuilding = document.getElementById('room-select-building');
    if (parseInt(roomSelectBuilding.value) === buildingIdx) {
        roomSelectBuilding.dispatchEvent(new Event('change'));
    }
});

// Update floor dropdown when building changes
const roomSelectBuilding = document.getElementById('room-select-building');
const roomSelectFloor = document.getElementById('room-select-floor');
roomSelectBuilding.addEventListener('change', (e) => {
    const buildingIdx = parseInt(e.target.value);
    roomSelectFloor.innerHTML = '<option value="">-- Select Floor --</option>';
    if (!isNaN(buildingIdx) && buildings[buildingIdx] && buildings[buildingIdx].floors.length > 0) {
        buildings[buildingIdx].floors.forEach((floor, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = floor.name;
            roomSelectFloor.appendChild(opt);
        });
    }
});

// Time checkboxes listener + allow custom typing
document.querySelectorAll('.time-check').forEach(ch => {
    ch.addEventListener('change', () => {
        let current = document.getElementById('room-time').value.trim();
        const checkedTimes = [];
        document.querySelectorAll('.time-check:checked').forEach(c => checkedTimes.push(c.value));

        const custom = current.split(',').map(t => t.trim()).filter(t => t && !checkedTimes.includes(t));
        document.getElementById('room-time').value = [...checkedTimes, ...custom].join(', ');
    });
});

// Department checkboxes listener → update displayed text
document.querySelectorAll('.dept-check').forEach(ch => {
    ch.addEventListener('change', () => {
        const selected = [];
        document.querySelectorAll('.dept-check:checked').forEach(c => selected.push(c.value));
        document.getElementById('room-department').value = selected.join(', ') || 'Select department';
    });
});

// Add Room button
document.getElementById('add-room').addEventListener('click', () => {
    const buildingIdx = parseInt(document.getElementById('room-select-building').value);
    const floorIdx    = parseInt(document.getElementById('room-select-floor').value);
    const name        = document.getElementById('room-name').value.trim();
    const cap         = parseInt(document.getElementById('room-capacity').value) || 50;

    const day         = document.getElementById('room-day').value.trim();

    const selectedTimes = [];
    document.querySelectorAll('.time-check:checked').forEach(ch => selectedTimes.push(ch.value));
    const extra = document.getElementById('room-time').value
        .split(',')
        .map(t => t.trim())
        .filter(t => t && !selectedTimes.includes(t));
    selectedTimes.push(...extra);

    const teacher     = document.getElementById('room-teacher').value.trim();
    const subject     = document.getElementById('room-subject').value.trim();
    const semester    = document.getElementById('room-semester').value.trim();

    const selectedDepartments = [];
    document.querySelectorAll('.dept-check:checked').forEach(ch => selectedDepartments.push(ch.value));

    if (isNaN(buildingIdx) || isNaN(floorIdx) || !name || isNaN(cap) ||
        !day || selectedTimes.length === 0 ||
        !teacher || !subject || !semester || selectedDepartments.length === 0) {
        
        alert("Please fill all required fields completely:\n- Building & Floor\n- Room Name\n- Capacity\n- Day\n- Time\n- Teacher\n- Subject\n- Semester\n- Department");
        return;
    }

    // Prepare arrays with correct length (one entry per time slot)
    const numSlots = selectedTimes.length;
    const repeatedDays     = Array(numSlots).fill(day);
    const repeatedTeachers = Array(numSlots).fill(teacher);
    const repeatedSubjects = Array(numSlots).fill(subject);

    const roomIndex = buildings[buildingIdx].floors[floorIdx].rooms.length;

    buildings[buildingIdx].floors[floorIdx].rooms.push({
        name,
        cap,
        
        // Permanent / configured slots (these will NEVER be auto-deleted)
        days: repeatedDays,
        timeSlots: [...selectedTimes],
        teachers: repeatedTeachers,
        subjects: repeatedSubjects,
        
        semester,
        department: [...selectedDepartments],

        // Temporary bookings (these will be deleted on expiry)
        bookedDays: [],
        bookedTimeSlots: [],
        bookedTeachers: [],
        bookedSubjects: [],
        bookedEndTimestamps: [],
        bookedIsActive: []
    });

    // ─── Save time slots permanently to floor level (so columns never disappear) ───
    const floor = buildings[buildingIdx].floors[floorIdx];
    if (!floor.allTimeSlots) floor.allTimeSlots = [];
    selectedTimes.forEach(t => {
        if (!floor.allTimeSlots.includes(t)) {
            floor.allTimeSlots.push(t);
        }
    });
    // ────────────────────────────────────────────────────────────────────────────────

    const displayDay = day || 'None';
    const displayTimes = selectedTimes.join(', ') || 'None';
    const displayDepts = selectedDepartments.join(', ') || 'None';

    const roomHtml = `
        <div class="configured-item" id="room-item-${buildingIdx}-${floorIdx}-${roomIndex}">
            🚪 ${buildings[buildingIdx].name} - ${buildings[buildingIdx].floors[floorIdx].name} - Room: ${name} 
            | Capacity: ${cap} 
            | Day: ${displayDay} 
            | Times: ${displayTimes} 
            | Teacher: ${teacher} 
            | Subject: ${subject} 
            | Semester: ${semester} 
            | Department: ${displayDepts}
            <span class="remove-room ms-2 text-danger" style="cursor:pointer; font-size:1.2em;" 
                  data-building="${buildingIdx}" 
                  data-floor="${floorIdx}" 
                  data-room="${roomIndex}">🗑️</span>
        </div>`;

    document.getElementById('added-rooms').innerHTML += roomHtml;
    document.getElementById('no-rooms').style.display = 'none';

    document.getElementById('room-name').value = '';
    document.getElementById('room-capacity').value = 50;
    document.getElementById('room-time').value = '';
    document.querySelectorAll('.time-check').forEach(ch => ch.checked = false);
    document.getElementById('room-teacher').value = '';
    document.getElementById('room-subject').value = '';
    document.getElementById('room-semester').value = '';
    document.getElementById('room-day').value = '';
    document.querySelectorAll('.dept-check').forEach(ch => ch.checked = false);
    document.getElementById('room-department').value = 'Select department';
    saveToLocal();
});

// Generate button → save to Firebase + switch view
document.getElementById('generate-btn').addEventListener('click', () => {
    if (buildings.length === 0) return alert("Setup buildings first!");
    let missing = [];
    buildings.forEach((b, i) => {
        if (b.floors.length === 0) {
            missing.push(b.name || `Building ${i+1}`);
        }
    });
    if (missing.length > 0) {
        alert("Cannot generate: The following buildings have no floors assigned:\n" + missing.join("\n"));
        return;
    }
    try {
        saveToLocal();
        console.log("Buildings data saved locally");
        generated = false;
    } catch (err) {
        console.error("Save failed:", err);
        alert("Could not save locally — check console");
        return;
    }
    document.querySelector('[data-view="view"]').click();
});

// Rebuild UI from loaded data – FIXED to show per-slot teacher/subject
function rebuildUIFromData() {
    const configuredBuildingsEl = document.getElementById('configured-buildings');
    const namedBuildingsEl     = document.getElementById('named-buildings');
    const configuredFloorsEl   = document.getElementById('configured-floors');
    const addedRoomsEl         = document.getElementById('added-rooms');

    configuredBuildingsEl.innerHTML = '';
    namedBuildingsEl.innerHTML     = '';
    configuredFloorsEl.innerHTML   = '';
    addedRoomsEl.innerHTML         = '';

    const selects = [
        document.getElementById('select-building'),
        document.getElementById('select-building-for-floors'),
        document.getElementById('room-select-building')
    ];

    selects.forEach(select => {
        select.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- Select Building --';
        select.appendChild(placeholder);
    });

    buildings.forEach((b, i) => {
        configuredBuildingsEl.innerHTML += `<div class="configured-item">🏢 ${b.name}</div>`;

        if (b.name !== `Building ${i+1}`) {
            namedBuildingsEl.innerHTML += `
                <div class="configured-item" id="named-item-${i}">
                    ✅ ${b.name}
                    <span class="remove-name ms-2 text-danger" style="cursor:pointer; font-size:1.2em;" data-building="${i}">🗑️</span>
                </div>`;
        }

        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = b.name;
        selects.forEach(s => s.appendChild(opt.cloneNode(true)));

        b.floors.forEach(floor => {
            configuredFloorsEl.innerHTML += `<div class="configured-item">📶 ${b.name} - ${floor.name} Floor</div>`;
        });

        b.floors.forEach((floor, fIdx) => {
            floor.rooms.forEach((room, rIdx) => {
                const displayDay   = room.days?.[0]   || 'None';
                const displayTimes = room.timeSlots?.join(', ') || 'None';
                const displayDepts = room.department?.join(', ') || 'None';

                // Use FIRST slot's teacher/subject for summary display (common practice)
                const displayTeacher = room.teachers?.[0] || room.teacher || 'None';  // fallback for old data
                const displaySubject = room.subjects?.[0] || room.subject || 'None';  // fallback for old data

                addedRoomsEl.innerHTML += `
                    <div class="configured-item" id="room-item-${i}-${fIdx}-${rIdx}">
                        🚪 ${b.name} - ${floor.name} - Room: ${room.name} 
                        | Capacity: ${room.cap} 
                        | Day: ${displayDay} 
                        | Times: ${displayTimes} 
                        | Teacher: ${displayTeacher} 
                        | Subject: ${displaySubject} 
                        | Semester: ${room.semester} 
                        | Department: ${displayDepts}
                        <span class="remove-room ms-2 text-danger" style="cursor:pointer; font-size:1.2em;" 
                              data-building="${i}" 
                              data-floor="${fIdx}" 
                              data-room="${rIdx}">🗑️</span>
                    </div>`;
            });
        });
    });

    if (buildings.length > 0) {
        document.getElementById('select-building').disabled = false;
        document.getElementById('add-name').disabled = false;
        document.getElementById('select-building-for-floors').disabled = false;
        document.getElementById('room-select-building').disabled = false;
    }

    document.getElementById('no-rooms').style.display = 
        document.querySelectorAll('#added-rooms .configured-item').length > 0 ? 'none' : 'block';
}

// ────────────────────────────────────────────────
// 3D Scene Setup — Mobile-Friendly with Touch Detection & Clean Tooltip
// ────────────────────────────────────────────────

let raycaster, mouse, tooltip;

function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(20, 18, 45);  // Better starting view for mobile

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // Sharp on phones
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Mobile-optimized OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.5;
    controls.panSpeed = 0.8;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.minDistance = 8;
    controls.maxDistance = 150;
    controls.enableRotate = true;
    controls.touchAction = "pan-y";

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(30, 50, 30); scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.6); dir2.position.set(-30, 50, -30); scene.add(dir2);

    // Ground
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(300, 300),
        new THREE.MeshLambertMaterial({ color: 0x90EE90 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    scene.add(ground);

    // Raycaster & tooltip
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    tooltip = document.createElement('div');
    tooltip.style.cssText = `
        position: absolute;
        background: rgba(0,0,0,0.85);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        pointer-events: none;
        display: none;
        z-index: 9999;
        font-size: 0.9rem;
        max-width: 240px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        transition: opacity 0.2s ease;
    `;
    document.body.appendChild(tooltip);

    // Helper to hide tooltip cleanly
    const hideTooltip = () => {
        tooltip.style.opacity = '0';
        setTimeout(() => { tooltip.style.display = 'none'; tooltip.style.opacity = '1'; }, 200);
    };

    // Hide when leaving canvas completely
    renderer.domElement.addEventListener('mouseleave', hideTooltip);
    renderer.domElement.addEventListener('touchend', hideTooltip);
    renderer.domElement.addEventListener('touchcancel', hideTooltip);

    // Hide tooltip when switching views or modals
    const hideOnUIChange = () => hideTooltip();
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.addEventListener('click', hideOnUIChange);
    });
    document.addEventListener('shown.bs.modal', hideOnUIChange);
    document.addEventListener('hidden.bs.modal', hideOnUIChange);

    // ── Unified Pointer Move (mouse + touch) ──
    const handlePointerMove = (clientX, clientY) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        tooltip.style.display = 'none';

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            let text = '';

            if (obj.userData.floorName) {
                text = obj.userData.floorName;
            } else if (obj.userData.isEntrance) {
                text = `Tap/Click to check availability`;
            }

            if (text) {
                tooltip.textContent = text;
                tooltip.style.display = 'block';

                // Smart positioning: near pointer, above it, clamped to screen
                let left = clientX + 20;
                let top = clientY - 50;

                // Prevent going off-screen
                if (left + 260 > window.innerWidth) left = window.innerWidth - 280;
                if (left < 10) left = 10;
                if (top < 10) top = 10 + 60; // Move below if too high

                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';
            }
        }
    };

    // PC mouse move
    renderer.domElement.addEventListener('mousemove', (e) => {
        handlePointerMove(e.clientX, e.clientY);
    });

    // Mobile touch move (hover simulation)
    renderer.domElement.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            handlePointerMove(touch.clientX, touch.clientY);
        } else {
            hideTooltip();
        }
    }, { passive: true });

    // ── Unified Click / Tap ──
    const handlePointerTap = (clientX, clientY) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        if (intersects.length > 0) {
            const obj = intersects[0].object;

            if (obj.userData.isEntrance && obj.userData.buildingIndex !== undefined) {
                showBuildingAvailability(obj.userData.buildingIndex);
            } else if (obj.userData.buildingIndex !== undefined && obj.userData.floorIndex !== undefined) {
                showFloorSchedule(obj.userData.buildingIndex, obj.userData.floorIndex);
            }
        }
        hideTooltip(); // Hide after tap
    };

    // PC click
    renderer.domElement.addEventListener('click', (e) => {
        handlePointerTap(e.clientX, e.clientY);
    });

    // Mobile tap
    renderer.domElement.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Stop scroll
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            handlePointerTap(touch.clientX, touch.clientY);
        }
    }, { passive: false });

    // Resize handling
    function onWindowResize() {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
        hideTooltip(); // Clean up on resize
    }

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', onWindowResize);
    onWindowResize(); // Initial call
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// ... rest of your code (generate3DBuildings, buildSingleBuilding, etc.) remains unchanged ...

function generate3DBuildings() {
    loadingBar.style.display = 'block';
    loadingProgress.style.width = '0%';
    loadingText.textContent = 'Preparing site...';
    initThreeJS();
    animate();

    const spacing = 25;
    const totalW = (buildings.length - 1) * spacing;
    let done = 0;

    buildings.forEach((building, i) => {
        const x = i * spacing - totalW / 2;
        setTimeout(() => {
            buildSingleBuilding(x, building.name, building.floors.length, i, () => {
                done++;
                const p = (done / buildings.length) * 100;
                loadingProgress.style.width = p + '%';
                loadingText.textContent = `Constructing ${building.name}... ${Math.round(p)}%`;
                if (done === buildings.length) {
                    addRoadsAndBoundaryWall();
                    setTimeout(() => {
                        loadingBar.style.display = 'none';
                        generated = true;
                    }, 1000);
                }
            });
        }, i * 1600);
    });
}

function buildSingleBuilding(x, name, numF, buildingIndex, cb) {
    const group = new THREE.Group();
    group.position.x = x;
    group.userData.buildingIndex = buildingIndex;
    scene.add(group);
    group.rotation.y = Math.PI;

    const width = 20, depth = 12, floorH = 4, baseHeight = 1, parapetHeight = 3;
    const base = new THREE.Mesh(
        new THREE.BoxGeometry(width, baseHeight, depth),
        new THREE.MeshLambertMaterial({ color: 0x888888 })
    );
    base.position.y = baseHeight / 2;
    group.add(base);

    const rodPos = [[-9.6,0,-5.6],[9.6,0,-5.6],[9.6,0,5.6],[-9.6,0,5.6]];
    const rods = [];
    rodPos.forEach(p => {
        const rod = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16),
            new THREE.MeshLambertMaterial({ color: 0x888888 })
        );
        rod.position.set(p[0], baseHeight + 0.05, p[2]);
        group.add(rod);
        rods.push(rod);
    });

    let h = 0.1;
    const targetH = numF * floorH + parapetHeight;
    const int = setInterval(() => {
        h += 0.2;
        rods.forEach(r => {
            r.scale.y = h / 0.1;
            r.position.y = baseHeight + h / 2;
        });
        if (h >= targetH) {
            clearInterval(int);
            addFloorsAndName(group, numF, name, rods, cb, width, depth, baseHeight, parapetHeight, floorH, buildingIndex);
        }
    }, 70);
}

function addFloorsAndName(group, numF, name, rods, cb, width, depth, baseHeight, parapetHeight, floorH, buildingIndex) {
    let cur = 0;
    const add = () => {
        if (cur >= numF) {
            const parapetY = baseHeight + numF * floorH + parapetHeight / 2;
            const parapet = new THREE.Mesh(
                new THREE.BoxGeometry(width, parapetHeight, depth),
                new THREE.MeshLambertMaterial({ color: 0xd0d0d0 })
            );
            parapet.position.y = parapetY;
            group.add(parapet);

            const ledge = new THREE.Mesh(
                new THREE.BoxGeometry(width + 1, 0.2, depth + 1),
                new THREE.MeshLambertMaterial({ color: 0xb0b0b0 })
            );
            ledge.position.y = parapetY + parapetHeight / 2 + 0.1;
            group.add(ledge);

            addBuildingName(group, name, parapetY, depth);
            addRoof(group, numF, floorH, width, depth, baseHeight, parapetHeight);
            addEntranceAndStairs(group, floorH, width, depth, baseHeight, buildingIndex);
            rods.forEach(r => r.visible = false);
            cb();
            return;
        }

        const floorY = baseHeight + floorH / 2 + cur * floorH;
        const floor = new THREE.Mesh(
            new THREE.BoxGeometry(width, floorH, depth),
            new THREE.MeshLambertMaterial({ color: 0xd0d0d0 })
        );
        floor.position.y = floorY;
        floor.userData = { 
            buildingIndex: buildingIndex, 
            floorIndex: cur, 
            floorName: buildings[buildingIndex].floors[cur].name 
        };
        group.add(floor);

        const ledge = new THREE.Mesh(
            new THREE.BoxGeometry(width + 1, 0.2, depth + 1),
            new THREE.MeshLambertMaterial({ color: 0xb0b0b0 })
        );
        ledge.position.y = floorY + floorH / 2 + 0.1;
        group.add(ledge);

        const windowMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Front windows — now with userData
        for (let w = 0; w < 5; w++) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.1), windowMat);
            win.position.set(-8 + w * 4, floorY, -depth / 2 - 0.05);
            win.userData = { 
                buildingIndex: buildingIndex, 
                floorIndex: cur, 
                floorName: buildings[buildingIndex].floors[cur].name 
            };
            group.add(win);
        }

        // Back windows — now with userData
        for (let w = 0; w < 5; w++) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.1), windowMat);
            win.position.set(-8 + w * 4, floorY, depth / 2 + 0.05);
            win.userData = { 
                buildingIndex: buildingIndex, 
                floorIndex: cur, 
                floorName: buildings[buildingIndex].floors[cur].name 
            };
            group.add(win);
        }

        // Left side windows — now with userData
        for (let w = 0; w < 2; w++) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 2), windowMat);
            win.position.set(-width / 2 - 0.05, floorY, -4 + w * 8);
            win.userData = { 
                buildingIndex: buildingIndex, 
                floorIndex: cur, 
                floorName: buildings[buildingIndex].floors[cur].name 
            };
            group.add(win);
        }

        // Right side windows — now with userData
        for (let w = 0; w < 2; w++) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 2), windowMat);
            win.position.set(width / 2 + 0.05, floorY, -4 + w * 8);
            win.userData = { 
                buildingIndex: buildingIndex, 
                floorIndex: cur, 
                floorName: buildings[buildingIndex].floors[cur].name 
            };
            group.add(win);
        }

        cur++;
        setTimeout(add, 450);
    };
    add();
}

function addBuildingName(group, name, baseY, depth) {
    const loader = new THREE.FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function (font) {
        const words = name.split(' ');
        let currentLine = '';
        let lines = [];
        words.forEach(word => {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            const testGeo = new THREE.TextGeometry(testLine, { font: font, size: 1.4, height: 0.4 });
            testGeo.computeBoundingBox();
            const testWidth = testGeo.boundingBox.max.x - testGeo.boundingBox.min.x;
            if (testWidth > 18 && currentLine !== '') {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        if (currentLine) lines.push(currentLine);
        if (lines.length > 2) lines = lines.slice(0, 2);

        const textGroup = new THREE.Group();
        const lineHeight = 1.8;

        lines.forEach((line, i) => {
            const textGeo = new THREE.TextGeometry(line, {
                font: font,
                size: 1.4,
                height: 0.4,
                curveSegments: 12
            });
            const textMesh = new THREE.Mesh(textGeo, new THREE.MeshLambertMaterial({ color: 0x000000 }));
            textMesh.position.x = 3;
            textMesh.position.y = (lines.length - 1) * lineHeight / 2 - i * lineHeight;
            textMesh.position.z = -depth / 2 - 0.35;
            textMesh.rotation.y = Math.PI;
            textGroup.add(textMesh);
        });

        textGroup.position.y = baseY - 0.5;
        group.add(textGroup);
    });
}

function addRoof(group, numF, floorH, width, depth, baseHeight, parapetHeight) {
    const topY = baseHeight + numF * floorH + parapetHeight;
    const roofHeight = 3, roofRun = depth / 2;
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-roofRun, 0);
    roofShape.lineTo(0, roofHeight);
    roofShape.lineTo(roofRun, 0);
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: width, bevelEnabled: false });
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0xdc3545 }));
    roof.rotation.y = Math.PI / 2;
    roof.position.set(-width / 2, topY, 0);
    group.add(roof);
}

function addEntranceAndStairs(group, floorH, width, depth, baseHeight, buildingIndex) {
    const entranceY = baseHeight + floorH / 2;

    // ── FIX: Make entrance box THINNER + tiny forward push ──
    // No polygonOffset — just geometry adjustment
    const entranceDepth = 2.6;          // was 3 → thinner avoids deep overlap
    const forwardOffset = -0.08;        // very small forward nudge (negative Z = closer to camera)

    const entrance = new THREE.Mesh(
        new THREE.BoxGeometry(8, floorH - 1, entranceDepth),
        new THREE.MeshLambertMaterial({ color: 0xc0c0c0 })
    );
    entrance.position.set(0, entranceY, -depth / 2 - 1.5 + forwardOffset);
    entrance.userData = { 
        isEntrance: true, 
        buildingIndex: buildingIndex 
    };
    group.add(entrance);

    // Door — now with userData so hover & click work here too
    const door = new THREE.Mesh(
        new THREE.BoxGeometry(4, floorH - 1.5, 0.1),
        new THREE.MeshLambertMaterial({ color: 0x000000 })
    );
    door.position.set(0, entranceY, -depth / 2 - 3 + 0.05 + forwardOffset);
    door.userData = { 
        isEntrance: true, 
        buildingIndex: buildingIndex 
    };
    group.add(door);

    // Stairs — apply same tiny offset
    const stepWidth = 10, climbHeight = baseHeight + 0.5, numSteps = 5;
    const stepHeight = climbHeight / numSteps, stepDepth = 0.5;
    let currentY = climbHeight - stepHeight / 2;
    let currentZ = -depth / 2 - 3 - stepDepth / 2 + forwardOffset;
    for (let i = 0; i < numSteps; i++) {
        const step = new THREE.Mesh(
            new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth),
            new THREE.MeshLambertMaterial({ color: 0x888888 })
        );
        step.position.set(0, currentY, currentZ);
        group.add(step);
        currentY -= stepHeight;
        currentZ -= stepDepth;
    }
}

// ────────────────────────────────────────────────
// Road + Boundary Wall
// ────────────────────────────────────────────────
function addRoadsAndBoundaryWall() {
    const buildingWidth = 20;
    const buildingDepth = 12;
    const spacing = 25;
    const totalWidth = (buildings.length - 1) * spacing + buildingWidth;

    const wallHeight = 6;
    const wallThickness = 0.6;
    const wallColor = 0x111111;

    const paddingSide = 15;
    const paddingFront = 20;
    const paddingBack = 5;

    const minX = -totalWidth / 2 - paddingSide;
    const maxX = totalWidth / 2 + paddingSide;
    const minZ = -buildingDepth / 2 - paddingBack;
    const maxZ = buildingDepth / 2 + paddingFront;

    const groundMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const innerGround = new THREE.Mesh(
        new THREE.PlaneGeometry(maxX - minX - 0.4, maxZ - minZ - 0.4),
        groundMat
    );
    innerGround.rotation.x = -Math.PI / 2;
    innerGround.position.set(0, -0.48, (minZ + maxZ) / 2);
    scene.add(innerGround);

    const wallMat = new THREE.MeshLambertMaterial({ color: wallColor });

    const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(maxX - minX, wallHeight, wallThickness),
        wallMat
    );
    backWall.position.set(0, wallHeight / 2, minZ);
    scene.add(backWall);

    const gateWidth = 14;
    const half = (maxX - minX - gateWidth) / 2;

    const frontLeft = new THREE.Mesh(
        new THREE.BoxGeometry(half, wallHeight, wallThickness),
        wallMat
    );
    frontLeft.position.set(minX + half / 2, wallHeight / 2, maxZ);
    scene.add(frontLeft);

    const frontRight = new THREE.Mesh(
        new THREE.BoxGeometry(half, wallHeight, wallThickness),
        wallMat
    );
    frontRight.position.set(maxX - half / 2, wallHeight / 2, maxZ);
    scene.add(frontRight);

    const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, wallHeight, maxZ - minZ + wallThickness * 2),
        wallMat
    );
    leftWall.position.set(minX, wallHeight / 2, (minZ + maxZ) / 2);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, wallHeight, maxZ - minZ + wallThickness * 2),
        wallMat
    );
    rightWall.position.set(maxX, wallHeight / 2, (minZ + maxZ) / 2);
    scene.add(rightWall);

    addModernGate(0, maxZ, gateWidth, wallHeight);
}

function addModernGate(x, z, gateWidth, gateHeight) {
    const gateMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x88aaff,
        metalness: 0.1,
        roughness: 0.1,
        transmission: 0.9,
        transparent: true,
        opacity: 0.7
    });

    const pillarGeo = new THREE.BoxGeometry(1.2, gateHeight, 1.2);
    const leftPillar = new THREE.Mesh(pillarGeo, gateMat);
    leftPillar.position.set(x - gateWidth/2 + 0.6, gateHeight/2, z);
    scene.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeo, gateMat);
    rightPillar.position.set(x + gateWidth/2 - 0.6, gateHeight/2, z);
    scene.add(rightPillar);

    const topBar = new THREE.Mesh(
        new THREE.BoxGeometry(gateWidth, 0.8, 1.2),
        gateMat
    );
    topBar.position.set(x, gateHeight - 0.4, z);
    scene.add(topBar);

    const glass = new THREE.Mesh(
        new THREE.BoxGeometry(gateWidth - 2.4, gateHeight - 1.6, 0.2),
        glassMat
    );
    glass.position.set(x, gateHeight/2 - 0.4, z);
    scene.add(glass);
}

// Theme presets & handlers
document.querySelectorAll('.preset-btn').forEach(b => {
    b.addEventListener('click', () => {
        const p = b.dataset.preset;
        const sets = {
            default: {h:'#4396e2',b:'#f5f7fa',c:'#ffffff',a:'#4396e2'},
            purple: {h:'#6f42c1',b:'#f3e8ff',c:'#ffffff',a:'#6f42c1'},
            green: {h:'#198754',b:'#e9f8f1',c:'#ffffff',a:'#198754'},
            orange: {h:'#fd7e14',b:'#fff3e6',c:'#ffffff',a:'#fd7e14'},
            red: {h:'#dc3545',b:'#fee2e2',c:'#ffffff',a:'#dc3545'},
            dark: {h:'#212529',b:'#343a40',c:'#495057',a:'#212529'}
        };
        const s = sets[p];
        document.getElementById('header-color').value = s.h;
        document.getElementById('body-color').value = s.b;
        document.getElementById('card-color').value = s.c;
        document.getElementById('accent-color').value = s.a;
    });
});

document.getElementById('apply-theme').addEventListener('click', () => {
    document.documentElement.style.setProperty('--header-bg', document.getElementById('header-color').value);
    document.documentElement.style.setProperty('--body-bg', document.getElementById('body-color').value);
    document.documentElement.style.setProperty('--card-bg', document.getElementById('card-color').value);
    document.documentElement.style.setProperty('--accent-color', document.getElementById('accent-color').value);
    bootstrap.Offcanvas.getInstance(document.getElementById('themeOffcanvas')).hide();
});

document.getElementById('reset-theme').addEventListener('click', () => {
    document.getElementById('header-color').value = '#4396e2';
    document.getElementById('body-color').value = '#f5f7fa';
    document.getElementById('card-color').value = '#ffffff';
    document.getElementById('accent-color').value = '#4396e2';
});

// ────────────────────────────────────────────────
// Time parsing & overlap functions (unchanged)
// ────────────────────────────────────────────────
function parseTime(timeStr) {
    if (!timeStr) return NaN;
    let str = timeStr.toLowerCase().trim();
    str = str.replace(/[^0-9apm ]/g, '');
    const isPM = /p/i.test(str);
    const isAM = /a/i.test(str);
    str = str.replace(/[apm ]/gi, '');
    if (str.length === 0) return NaN;
    let h, m = 0;
    if (str.length <= 2) {
        h = parseInt(str);
    } else if (str.length === 3) {
        h = parseInt(str[0]);
        m = parseInt(str.substring(1));
    } else if (str.length === 4) {
        h = parseInt(str.substring(0, 2));
        m = parseInt(str.substring(2));
    } else return NaN;
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return NaN;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h * 60 + m;
}
function parseTimeRange(timeStr) {
    if (!timeStr) return null;
    let s = timeStr.toLowerCase().trim();
    const separatorRegex = /[–—−~→to-]/i;
    const parts = s.split(separatorRegex).map(p => p.trim());
    if (parts.length < 2) {
        const single = parseTime(s);
        if (isNaN(single)) return null;
        return { start: single, end: single + 60 };
    }
    const startStr = parts[0];
    const endStr = parts.slice(1).join(' ');
    const start = parseTime(startStr);
    let end = parseTime(endStr);
    if (isNaN(start) || isNaN(end)) return null;
    if (end <= start) end += 720;
    if (end <= start) return null;
    return { start, end };
}
function timesOverlap(requestedRange, existingSlot) {
    const req = parseTimeRange(requestedRange);
    const ex = parseTimeRange(existingSlot);
    if (!req || !ex) return false;
    return (req.start < ex.end) && (ex.start < req.end);
}

// ────────────────────────────────────────────────
// Availability Checker — Time is SIMPLE text input ONLY (no checkboxes, no expand, no logic)
// ────────────────────────────────────────────────
function showBuildingAvailability(buildingIndex) {
    const building = buildings[buildingIndex];
    const modalEl = document.getElementById('buildingAvailabilityModal');
    const titleEl = document.getElementById('buildingAvailabilityLabel');
    const nameEl = document.getElementById('building-name-in-modal');
    const resultsEl = document.getElementById('avail-results');

    titleEl.textContent = `Availability Checker - ${building.name}`;
    nameEl.textContent = building.name;
    resultsEl.innerHTML = '';

    const searchBtn = document.getElementById('search-avail-btn');
    const daySelect = document.getElementById('avail-day');
    const timeInput = document.getElementById('avail-time');
    const minCapInput = document.getElementById('avail-min-capacity');

    // Reset to plain text input
    timeInput.value = '';
    timeInput.placeholder = "e.g. 08:30 – 10:00, 10:00 – 11:30";

    searchBtn.replaceWith(searchBtn.cloneNode(true));
    const newSearchBtn = document.getElementById('search-avail-btn');

    newSearchBtn.addEventListener('click', () => {
        const day = daySelect.value.trim();
        const timeRange = timeInput.value.trim();

        if (!day || !timeRange) {
            alert("Please select day and enter time range (e.g. 08:30 – 14:20)");
            return;
        }

        const minCap = parseInt(minCapInput.value) || 0;

        let html = `<h5 class="mb-3">Free rooms on <strong>${day}</strong> during <strong>${timeRange}</strong></h5>`;
        if (minCap > 0) html += `<p class="text-muted">Minimum capacity: ${minCap} students</p>`;

        let found = false;

        building.floors.forEach((floor, fIdx) => {
            const uniqueRooms = {};

            floor.rooms.forEach((r, roomIdx) => {
                const nameKey = r.name.toLowerCase().trim();
                if (!uniqueRooms[nameKey]) {
                    uniqueRooms[nameKey] = { free: true, firstRoom: r, firstIdx: roomIdx };
                }
                const hasOverlap = r.days.includes(day) && 
                                   r.timeSlots.some(slot => timesOverlap(timeRange, slot));
                if (hasOverlap) {
                    uniqueRooms[nameKey].free = false;
                }
            });

            const freeRooms = Object.values(uniqueRooms)
                .filter(group => group.free && (minCap <= 0 || group.firstRoom.cap >= minCap))
                .map(group => ({ r: group.firstRoom, roomIdx: group.firstIdx }));

            if (freeRooms.length > 0) {
                found = true;
                html += `
                    <div class="card mb-3 border-success">
                        <div class="card-header bg-success text-white">
                            ${floor.name} Floor
                        </div>
                        <div class="card-body">
                            <div class="row g-2">`;

                freeRooms.forEach(({ r, roomIdx }) => {
                    html += `
                        <div class="col-md-6 col-lg-4">
                            <div class="p-2 border border-success rounded bg-light">
                                <strong>${r.name}</strong><br>
                                <small>Capacity: ${r.cap} | ${r.teacher || 'No teacher'}</small>
                                <button class="btn btn-sm btn-success mt-2 w-100 book-room-btn" 
                                        data-building="${buildingIndex}" 
                                        data-floor="${fIdx}" 
                                        data-room="${roomIdx}"
                                        data-day="${day}"
                                        data-time="${timeRange}">
                                    Book This Room
                                </button>
                            </div>
                        </div>`;
                });

                html += '</div></div></div>';
            }
        });

        if (!found) {
            html += '<div class="alert alert-info">No completely free rooms in this time range.</div>';
        }

        resultsEl.innerHTML = html;

        document.querySelectorAll('.book-room-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const bIdx = parseInt(btn.dataset.building);
                const fIdx = parseInt(btn.dataset.floor);
                const rIdx = parseInt(btn.dataset.room);
                const dayVal = btn.dataset.day;
                const timeVal = btn.dataset.time;
                openBookingModal(bIdx, fIdx, rIdx, dayVal, timeVal);
            });
        });
    });

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

// ────────────────────────────────────────────────
// FIXED Booking Modal: Expiry always today in REAL Pakistan time (PROTECT CONFIG SLOTS)
// ────────────────────────────────────────────────
function openBookingModal(buildingIdx, floorIdx, roomIdx, day, time) {
    const building = buildings[buildingIdx];
    const floor = building.floors[floorIdx];
    const room = floor.rooms[roomIdx];

    document.getElementById('booking-room-info').innerHTML = `
        Building: <strong>${building.name}</strong><br>
        Floor: <strong>${floor.name}</strong><br>
        Room: <strong>${room.name}</strong><br>
        Day: <strong>${day}</strong><br>
        Time: <strong>${time}</strong>
    `;

    const teacherInput = document.getElementById('booking-room-teacher');
    const subjectInput = document.getElementById('booking-room-subject');
    teacherInput.value = '';
    subjectInput.value = '';

    const bookingModal = new bootstrap.Modal(document.getElementById('bookingModal'));
    bookingModal.show();

    const confirmBtn = document.getElementById('confirm-booking-btn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.replaceWith(newConfirmBtn);

    newConfirmBtn.addEventListener('click', () => {
        const teacher = teacherInput.value.trim();
        const subject = subjectInput.value.trim();

        if (!teacher || !subject) {
            alert("Please enter teacher name and subject.");
            return;
        }

        // ── FIX: Force correct day name (if modal sends invalid like '10', '1', etc.) ──
        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        if (!validDays.includes(day)) {
            console.warn("Invalid day from availability modal:", day, "→ forcing 'Monday'");
            day = 'Monday';  // change to any default you prefer
        }
        // ────────────────────────────────────────────────────────────────────────

        // ── Get CURRENT real time in Pakistan ──
        const nowStr = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Karachi',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).format(new Date());

        const [datePart, timePart] = nowStr.split(', ');
        const [month, dayNum, year] = datePart.split('/');
        const [hour, min, sec] = timePart.split(':');
        const nowInPKT = new Date(Date.UTC(year, month-1, dayNum, hour, min, sec));

        // ── Create end time using Pakistan's TODAY + class end time ──
        const endStr = time.split(/[-–]/)[1]?.trim() || '23:59';
        const [endH, endM] = endStr.split(':').map(Number);

        const endDate = new Date(nowInPKT);
        endDate.setUTCHours(endH || 23, endM || 59, 0, 0);

        // Grace period: only expire if class ended > 5 minutes ago (prevents instant wipe during test)
        const graceMs = 5 * 60 * 1000; // 5 minutes
        if (endDate.getTime() < nowInPKT.getTime() - graceMs) {
            endDate.setTime(nowInPKT.getTime() - 10000); // expire immediately
        }

        const endTimestamp = endDate.getTime();

        // Add / update in booked arrays only (never touch permanent days/timeSlots/etc.)
        const existingBookingIdx = room.bookedDays.findIndex((d, i) => 
            d === day && room.bookedTimeSlots[i] === time
        );

        if (existingBookingIdx !== -1) {
            // Update existing booking
            room.bookedTeachers[existingBookingIdx] = teacher;
            room.bookedSubjects[existingBookingIdx] = subject;
            room.bookedEndTimestamps[existingBookingIdx] = endTimestamp;
            room.bookedIsActive[existingBookingIdx] = true;
        } else {
            // New booking slot
            room.bookedDays.push(day);
            room.bookedTimeSlots.push(time);
            room.bookedTeachers.push(teacher);
            room.bookedSubjects.push(subject);
            room.bookedEndTimestamps.push(endTimestamp);
            room.bookedIsActive.push(true);

            if (!room.semester || room.semester.trim() === '') {
                room.semester = "Booked Class";
            }
            if (!room.department || room.department.length === 0) {
                room.department = ["General"];
            }
        }

        // Update allTimeSlots
        if (!floor.allTimeSlots) floor.allTimeSlots = [];
        if (!floor.allTimeSlots.includes(time)) {
            floor.allTimeSlots.push(time);
        }

        saveToLocal();

        console.log("=== BOOKING SAVED ===", {
            day,
            time,
            teacher,
            subject,
            roomDays: room.days,
            roomTimeSlots: room.timeSlots,
            roomTeachers: room.teachers,
            roomSubjects: room.subjects,
            roomSemester: room.semester,
            bookedDays: room.bookedDays,
            bookedTimeSlots: room.bookedTimeSlots,
            bookedTeachers: room.bookedTeachers,
            bookedSubjects: room.bookedSubjects,
            bookedEndTimestamps: room.bookedEndTimestamps,
            bookedIsActive: room.bookedIsActive,
            allTimeSlots: floor.allTimeSlots
        });

        const expiryTimeStr = new Date(endTimestamp).toLocaleTimeString('en-PK', {
            timeZone: 'Asia/Karachi',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        alert(`Room booked successfully for ${day} ${time}!\nTeacher: ${teacher}\nSubject: ${subject}\nExpires at: ${expiryTimeStr} today (PKT)`);

        bookingModal.hide();

        showBuildingAvailability(buildingIdx);

        const scheduleModal = bootstrap.Modal.getInstance(document.getElementById('floorScheduleModal'));
        if (scheduleModal && scheduleModal.isShown) {
            showFloorSchedule(buildingIdx, floorIdx);
        }
    });
}

// ────────────────────────────────────────────────
// FIXED: Predefined times ALWAYS stay in exact fixed order
// Only NEW custom times are inserted after closest predefined
// Previous/Next Floor buttons always present
// Clean message when no timeslots
// ────────────────────────────────────────────────
function showFloorSchedule(buildingIndex, floorIndex) {
    const floor = buildings[buildingIndex].floors[floorIndex];
    const modalEl = document.getElementById('floorScheduleModal');
    const titleEl = document.getElementById('floorScheduleLabel');
    const tableContainer = document.getElementById('floor-schedule-table');

    titleEl.textContent = `${buildings[buildingIndex].name} - ${floor.name} Schedule`;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Predefined times — FIXED ORDER, never changed
    const predefinedOrder = [
        "08:30 – 10:00",
        "10:00 – 11:30",
        "11:30 – 01:00",
        "01:00 – 02:30",
        "02:30 – 04:00"
    ];

    // Get all saved times
    let savedTimes = floor.allTimeSlots || [];
    if (!savedTimes.length && floor.rooms.length > 0) {
        const tempSet = new Set();
        floor.rooms.forEach(room => room.timeSlots.forEach(t => tempSet.add(t)));
        savedTimes = Array.from(tempSet);
        floor.allTimeSlots = savedTimes;
    }

    // 1. Which predefined times are actually used (keep exact order)
    const usedPredefined = [];
    predefinedOrder.forEach(p => {
        if (savedTimes.includes(p)) {
            usedPredefined.push(p);
        }
    });

    // 2. All custom times (anything not in predefined list)
    const allCustomTimes = savedTimes.filter(t => !predefinedOrder.includes(t));

    // Helper: get start time in minutes
    const getStart = (slot) => {
        const range = parseTimeRange(slot);
        return range ? range.start : (parseTime(slot) || 0);
    };

    // Start with fixed predefined order
    let finalSlots = [...usedPredefined];

    // Insert each custom time right after the closest predefined
    const customsWithDistance = allCustomTimes.map(custom => ({
        time: custom,
        dist: Math.min(...usedPredefined.map(p => Math.abs(getStart(custom) - getStart(p)) || Infinity))
    })).sort((a,b) => a.dist - b.dist);

    customsWithDistance.forEach(({ time: custom }) => {
        let insertAfterIndex = -1;
        let closestDiff = Infinity;

        usedPredefined.forEach((predef, idx) => {
            const diff = Math.abs(getStart(custom) - getStart(predef));
            if (diff < closestDiff) {
                closestDiff = diff;
                insertAfterIndex = idx;
            }
        });

        if (insertAfterIndex === -1 || usedPredefined.length === 0) {
            finalSlots.push(custom);
        } else {
            let insertPos = insertAfterIndex + 1;
            while (insertPos < finalSlots.length && !predefinedOrder.includes(finalSlots[insertPos])) {
                insertPos++;
            }
            finalSlots.splice(insertPos, 0, custom);
        }
    });

    const timeSlots = finalSlots;

    // If no times → clean message
    if (timeSlots.length === 0) {
        tableContainer.innerHTML = `
            <div class="alert alert-info text-center my-5 py-5">
                <h5>No classes or time slots configured on this floor yet.</h5>
                <p class="mt-3">Add rooms with time slots in the configuration panel to see the timetable.</p>
            </div>
        `;
    } else {
        // Build full table
        let html = '<div class="table-responsive"><table class="table table-bordered timetable-grid">';
        html += '<thead><tr><th>Day / Time</th>';
        timeSlots.forEach(t => html += `<th>${t}</th>`);
        html += '</tr></thead><tbody>';

        days.forEach(day => {
            html += `<tr><td class="day-header">${day}</td>`;
            timeSlots.forEach(time => {
                html += `<td class="timetable-cell droppable" data-day="${day}" data-time="${time}">`;

                let matchingRooms = [];

                // Permanent configured slots
                floor.rooms.forEach((r, realIdx) => {
                    r.days.forEach((d, slotIdx) => {
                        if (d === day && r.timeSlots[slotIdx] === time) {
                            matchingRooms.push({
                                room: r,
                                realIdx,
                                slotIndex: slotIdx,
                                isBooked: false
                            });
                        }
                    });
                });

                // Active booked slots (override if same time)
                floor.rooms.forEach((r, realIdx) => {
                    r.bookedDays.forEach((bd, bIdx) => {
                        if (bd === day && r.bookedTimeSlots[bIdx] === time && r.bookedIsActive[bIdx]) {
                            // Remove any permanent entry for this same room
                            matchingRooms = matchingRooms.filter(m => m.room !== r);
                            matchingRooms.push({
                                room: r,
                                realIdx,
                                slotIndex: bIdx,
                                isBooked: true
                            });
                        }
                    });
                });

                matchingRooms.forEach(({ room, realIdx, slotIndex, isBooked }, displayIdx) => {
                    let blockTeacher, blockSubject;

                    if (isBooked) {
                        blockTeacher = room.bookedTeachers?.[slotIndex] || '';
                        blockSubject = room.bookedSubjects?.[slotIndex] || '';
                    } else {
                        blockTeacher = room.teachers?.[slotIndex] || '';
                        blockSubject = room.subjects?.[slotIndex] || '';
                    }

                    const blockId = `block-${buildingIndex}-${floorIndex}-${day}-${time.replace(/[^a-zA-Z0-9]/g,'')}-${displayIdx}`;
                    html += `
                        <div class="timetable-block ${isBooked ? 'bg-warning text-dark' : ''}" draggable="true"
                             data-building="${buildingIndex}"
                             data-floor="${floorIndex}"
                             data-room-idx="${realIdx}"
                             data-day="${day}"
                             data-time="${time}"
                             id="${blockId}">
                            <strong>${room.name}</strong><br>
                            Cap: ${room.cap} | ${blockTeacher}<br>
                            ${blockSubject} (${room.semester || ''})
                            ${isBooked ? '<small class="text-danger">(Booked)</small>' : ''}
                        </div>
                    `;
                });

                html += '</td>';
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        tableContainer.innerHTML = html;
    }

    // Footer: Previous / Next + Close
    const footerEl = modalEl.querySelector('.modal-footer');
    footerEl.innerHTML = '';

    if (floorIndex > 0) {
        const prev = document.createElement('button');
        prev.className = 'btn btn-primary';
        prev.textContent = 'Previous Floor';
        prev.onclick = () => showFloorSchedule(buildingIndex, floorIndex - 1);
        footerEl.appendChild(prev);
    }

    if (floorIndex < buildings[buildingIndex].floors.length - 1) {
        const next = document.createElement('button');
        next.className = 'btn btn-primary ms-2';
        next.textContent = 'Next Floor';
        next.onclick = () => showFloorSchedule(buildingIndex, floorIndex + 1);
        footerEl.appendChild(next);
    }

    const close = document.createElement('button');
    close.className = 'btn btn-secondary ms-2';
    close.setAttribute('data-bs-dismiss', 'modal');
    close.textContent = 'Close';
    footerEl.appendChild(close);

    // Drag & Drop ────────────────────────────────────────────────
    let dragged = null;

    document.querySelectorAll('.timetable-block').forEach(el => {
        el.addEventListener('dragstart', e => {
            dragged = {
                buildingIndex,
                floorIndex,
                roomIdx: parseInt(el.dataset.roomIdx),
                day: el.dataset.day,
                time: el.dataset.time
            };
            el.classList.add('dragging');
        });

        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            dragged = null;
        });
    });

    document.querySelectorAll('.droppable').forEach(cell => {
        cell.addEventListener('dragover', e => {
            e.preventDefault();
            cell.classList.add('drag-over');
        });

        cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));

        cell.addEventListener('drop', e => {
            e.preventDefault();
            cell.classList.remove('drag-over');

            if (!dragged) return;

            const targetDay = cell.dataset.day;
            const targetTime = cell.dataset.time;

            if (targetDay === dragged.day && targetTime === dragged.time) return;

            const room = buildings[dragged.buildingIndex].floors[dragged.floorIndex].rooms[dragged.roomIdx];

            // ─── FIXED: Save teacher & subject BEFORE removing old slot ───
            const oldIndex = room.days.findIndex((d, i) => d === dragged.day && room.timeSlots[i] === dragged.time);
            let movingTeacher = '';
            let movingSubject = '';

            if (oldIndex !== -1) {
                movingTeacher = room.teachers[oldIndex] || '';
                movingSubject = room.subjects[oldIndex] || '';

                // Now safely remove old slot
                room.days.splice(oldIndex, 1);
                room.timeSlots.splice(oldIndex, 1);
                room.teachers.splice(oldIndex, 1);
                room.subjects.splice(oldIndex, 1);
            }

            const alreadyHas = room.days.some((d, i) => d === targetDay && room.timeSlots[i] === targetTime);
            if (!alreadyHas) {
                room.days.push(targetDay);
                room.timeSlots.push(targetTime);
                room.teachers.push(movingTeacher);    // ← now carries over original teacher
                room.subjects.push(movingSubject);    // ← now carries over original subject
            }

            saveToLocal();

            showFloorSchedule(buildingIndex, floorIndex);
        });
    });
    // ────────────────────────────────────────────────────────────────

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    modalEl.addEventListener('hidden.bs.modal', () => {
        tableContainer.innerHTML = '';
        footerEl.innerHTML = '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>';
    }, { once: true });
}
// ────────────────────────────────────────────────
// Auto-expire bookings — using REAL Pakistan time (PER SLOT + ONLY BOOKED)
// ────────────────────────────────────────────────
function checkAndExpireBookings() {
    let changed = false;

    // Get current real time in Pakistan
    const nowStr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(new Date());

    const [datePart, timePart] = nowStr.split(', ');
    const [month, day, year] = datePart.split('/');
    const [hour, min, sec] = timePart.split(':');
    const nowInPKT_ms = new Date(Date.UTC(year, month-1, day, hour, min, sec)).getTime();

    buildings.forEach(building => {
        building.floors.forEach(floor => {
            floor.rooms.forEach(room => {
                // If no booked timestamps, skip
                if (!room.bookedEndTimestamps || !Array.isArray(room.bookedEndTimestamps)) return;

                // Check each booked slot from last to first (safe for splicing)
                for (let i = room.bookedEndTimestamps.length - 1; i >= 0; i--) {
                    const slotEnd = room.bookedEndTimestamps[i];

                    if (slotEnd && nowInPKT_ms > slotEnd) {
                        console.log(`EXPIRING SLOT ${i} in ${room.name}: ${room.bookedDays[i]} ${room.bookedTimeSlots[i]} (ended at ${new Date(slotEnd).toLocaleString('en-PK', {timeZone: 'Asia/Karachi'})})`);

                        room.bookedDays.splice(i, 1);
                        room.bookedTimeSlots.splice(i, 1);
                        room.bookedTeachers.splice(i, 1);
                        room.bookedSubjects.splice(i, 1);
                        room.bookedEndTimestamps.splice(i, 1);
                        room.bookedIsActive.splice(i, 1);
                        changed = true;
                    }
                }
            });

            // Clean up unused time slots from floor.allTimeSlots (removes empty columns)
            if (floor.allTimeSlots && floor.allTimeSlots.length > 0) {
                const stillUsed = new Set();
                floor.rooms.forEach(room => {
                    room.timeSlots.forEach(t => stillUsed.add(t));           // permanent slots
                    room.bookedTimeSlots.forEach(t => stillUsed.add(t));     // active booked slots
                });
                const oldCount = floor.allTimeSlots.length;
                floor.allTimeSlots = floor.allTimeSlots.filter(t => stillUsed.has(t));
                if (floor.allTimeSlots.length < oldCount) {
                    console.log(`Cleaned up ${oldCount - floor.allTimeSlots.length} unused time slots from floor`);
                    changed = true;
                }
            }
        });
    });

    if (changed) {
        saveToLocal();
        console.log("Expired bookings removed + unused times cleaned (per-slot expiry)");
    }
}
// ────────────────────────────────────────────────
// Clear All Data
// ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const clearBtn = document.getElementById('clear-data-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm("Delete ALL data permanently?")) {
                localStorage.removeItem('buildingsData');   // ← Clears local storage
                buildings = [];
                generated = false;
                if (container) container.innerHTML = '';
                location.reload();
            }
        });
    }
});
// ────────────────────────────────────────────────
// Delete listeners – FIXED: fully clean allTimeSlots when no rooms remain
// ────────────────────────────────────────────────
function attachDeleteListeners() {
    document.getElementById('added-rooms').addEventListener('click', async (e) => {
        if (e.target.classList.contains('remove-room')) {
            const buildingIdx = parseInt(e.target.dataset.building);
            const floorIdx = parseInt(e.target.dataset.floor);
            const roomIdx = parseInt(e.target.dataset.room);

            // Remove the room
            buildings[buildingIdx].floors[floorIdx].rooms.splice(roomIdx, 1);
            e.target.parentElement.remove();

            // Show "no rooms" message if empty
            if (document.querySelectorAll('#added-rooms .configured-item').length === 0) {
                document.getElementById('no-rooms').style.display = 'block';
            }

            // Clean up time slots
            const floor = buildings[buildingIdx].floors[floorIdx];
            if (floor.allTimeSlots && floor.allTimeSlots.length > 0) {
                const usedTimes = new Set();
                floor.rooms.forEach(room => {
                    room.timeSlots.forEach(t => usedTimes.add(t));
                });

                // Keep only times still used by at least one room
                floor.allTimeSlots = floor.allTimeSlots.filter(t => usedTimes.has(t));

                // CRITICAL: If no rooms left → completely delete allTimeSlots
                if (floor.rooms.length === 0 || floor.allTimeSlots.length === 0) {
                    delete floor.allTimeSlots;
                }
            }

            saveToLocal();
        }
    });

    document.getElementById('named-buildings').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-name')) {
        const buildingIdx = parseInt(e.target.dataset.building);
        buildings[buildingIdx].name = `Building ${buildingIdx + 1}`;
        const selects = [
            document.getElementById('select-building'),
            document.getElementById('select-building-for-floors'),
            document.getElementById('room-select-building')
        ];
        selects.forEach(select => {
            select.options[buildingIdx + 1].textContent = buildings[buildingIdx].name;
        });
        e.target.parentElement.remove();
        saveToLocal();  // ← FIXED: no async, no Firebase
    }
});

    // Auto-fill availability time when checkboxes are checked (robust version)
document.addEventListener('shown.bs.modal', function (e) {
    if (e.target.id !== 'buildingAvailabilityModal') return;

    const modal = e.target;
    const timeInput = modal.querySelector('#avail-time');

    // Use event delegation: listen on modal once, catch all checkbox changes
    modal.addEventListener('change', function (event) {
        if (!event.target.classList.contains('time-check')) return;

        let current = timeInput.value.trim();
        const checkedTimes = [];
        modal.querySelectorAll('.time-check:checked').forEach(c => checkedTimes.push(c.value));

        const custom = current.split(',').map(t => t.trim()).filter(t => t && !checkedTimes.includes(t));
        timeInput.value = [...checkedTimes, ...custom].join(', ');
    }, { once: false });  // Keep listener active for multiple opens
});
}