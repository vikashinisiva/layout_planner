// 3D Building Visualization using Three.js

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store/appStore';
import { getUnitById } from '../data/unitTemplates';

export const ThreeView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [isRotating, setIsRotating] = useState(true);
  
  const { buildings } = useAppStore();
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Setup
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f4f8);
    sceneRef.current = scene;
    
    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(50, 50, 50);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x88aa88,
      roughness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Grid helper
    const gridHelper = new THREE.GridHelper(200, 50, 0x666666, 0xcccccc);
    scene.add(gridHelper);
    
    // Animation loop
    let animationId: number;
    let angle = 0;
    
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      
      if (isRotating && cameraRef.current) {
        angle += 0.002;
        const radius = 80;
        cameraRef.current.position.x = Math.cos(angle) * radius;
        cameraRef.current.position.z = Math.sin(angle) * radius;
        cameraRef.current.lookAt(0, 10, 0);
      }
      
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Mouse controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
      setIsRotating(false);
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !cameraRef.current) return;
      
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      
      const radius = Math.sqrt(
        cameraRef.current.position.x ** 2 + cameraRef.current.position.z ** 2
      );
      
      angle += deltaX * 0.005;
      cameraRef.current.position.x = Math.cos(angle) * radius;
      cameraRef.current.position.z = Math.sin(angle) * radius;
      cameraRef.current.position.y = Math.max(10, Math.min(100, cameraRef.current.position.y - deltaY * 0.2));
      cameraRef.current.lookAt(0, 10, 0);
      
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };
    
    const handleMouseUp = () => {
      isDragging = false;
    };
    
    const handleWheel = (e: WheelEvent) => {
      if (!cameraRef.current) return;
      const delta = e.deltaY * 0.1;
      const direction = new THREE.Vector3();
      cameraRef.current.getWorldDirection(direction);
      cameraRef.current.position.addScaledVector(direction, -delta);
    };
    
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('wheel', handleWheel);
    
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);
  
  // Update buildings when they change
  useEffect(() => {
    if (!sceneRef.current) return;
    
    // Remove existing building meshes
    const toRemove: THREE.Object3D[] = [];
    sceneRef.current.traverse((child) => {
      if (child.userData.isBuilding) {
        toRemove.push(child);
      }
    });
    toRemove.forEach(obj => sceneRef.current!.remove(obj));
    
    // Define building colors by BHK type
    const floorColors: { [key: string]: number } = {
      '1RK': 0xffe082,
      '1BHK': 0x4fc3f7,
      '1.5BHK': 0x80cbc4,
      '2BHK': 0x66bb6a,
      '2.5BHK': 0xce93d8,
      '3BHK': 0xff8a65,
      '4BHK': 0xe57373,
    };
    
    // Create new building meshes
    buildings.forEach((building, bIndex) => {
      const buildingGroup = new THREE.Group();
      buildingGroup.userData.isBuilding = true;
      
      // Building base position (offset each building)
      const offsetX = bIndex * 30 - (buildings.length - 1) * 15;
      
      // Create floors
      for (let floor = 0; floor < building.floors; floor++) {
        const isStilt = building.stiltParking && floor === 0;
        const floorHeight = building.floorHeight;
        const floorY = floor * floorHeight;
        
        if (isStilt) {
          // Stilt floor with pillars
          const pillarGeometry = new THREE.CylinderGeometry(0.3, 0.3, floorHeight, 8);
          const pillarMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
          
          // Add pillars in a grid
          for (let x = -8; x <= 8; x += 4) {
            for (let z = -5; z <= 5; z += 4) {
              const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
              pillar.position.set(x + offsetX, floorHeight / 2, z);
              pillar.castShadow = true;
              buildingGroup.add(pillar);
            }
          }
          
          // Add slab on top
          const slabGeometry = new THREE.BoxGeometry(20, 0.3, 14);
          const slabMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
          const slab = new THREE.Mesh(slabGeometry, slabMaterial);
          slab.position.set(offsetX, floorHeight, 0);
          slab.castShadow = true;
          slab.receiveShadow = true;
          buildingGroup.add(slab);
        } else {
          // Get units on this floor and create colored sections
          const floorUnits = building.units.filter(u => u.floor === floor);
          
          if (floorUnits.length > 0) {
            // Create unit blocks
            floorUnits.forEach((unit, uIndex) => {
              const unitType = getUnitById(unit.unitTypeId);
              if (!unitType) return;
              
              const unitWidth = unitType.width;
              const unitDepth = unitType.depth;
              const unitGeometry = new THREE.BoxGeometry(unitWidth, floorHeight - 0.1, unitDepth);
              
              const color = floorColors[unitType.bhkType] || 0x9e9e9e;
              const unitMaterial = new THREE.MeshStandardMaterial({ 
                color,
                roughness: 0.7,
              });
              
              const unitMesh = new THREE.Mesh(unitGeometry, unitMaterial);
              
              // Position based on unit placement (simplified)
              const posX = (uIndex % 4 - 1.5) * (unitWidth + 0.5) + offsetX;
              const posZ = (Math.floor(uIndex / 4) - 0.5) * (unitDepth + 0.5);
              
              unitMesh.position.set(
                posX,
                floorY + floorHeight / 2 + (building.stiltParking ? floorHeight : 0),
                posZ
              );
              unitMesh.castShadow = true;
              unitMesh.receiveShadow = true;
              buildingGroup.add(unitMesh);
              
              // Add edges
              const edges = new THREE.EdgesGeometry(unitGeometry);
              const line = new THREE.LineSegments(
                edges,
                new THREE.LineBasicMaterial({ color: 0x333333 })
              );
              line.position.copy(unitMesh.position);
              buildingGroup.add(line);
            });
          } else {
            // Simple floor block if no units defined
            const floorGeometry = new THREE.BoxGeometry(20, floorHeight - 0.1, 14);
            const floorMaterial = new THREE.MeshStandardMaterial({ 
              color: 0x4f46e5,
              roughness: 0.7,
            });
            const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
            floorMesh.position.set(
              offsetX, 
              floorY + floorHeight / 2 + (building.stiltParking ? floorHeight : 0),
              0
            );
            floorMesh.castShadow = true;
            floorMesh.receiveShadow = true;
            buildingGroup.add(floorMesh);
          }
        }
      }
      
      // Add building label
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = 256;
      canvas.height = 64;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, 256, 64);
      context.fillStyle = '#333333';
      context.font = 'bold 32px Arial';
      context.textAlign = 'center';
      context.fillText(building.name, 128, 42);
      
      const texture = new THREE.CanvasTexture(canvas);
      const labelMaterial = new THREE.SpriteMaterial({ map: texture });
      const label = new THREE.Sprite(labelMaterial);
      label.scale.set(10, 2.5, 1);
      label.position.set(offsetX, building.floors * building.floorHeight + 5, 0);
      buildingGroup.add(label);
      
      sceneRef.current!.add(buildingGroup);
    });
    
    // If no buildings, add a placeholder
    if (buildings.length === 0) {
      const placeholderGeometry = new THREE.BoxGeometry(15, 20, 10);
      const placeholderMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4f46e5,
        transparent: true,
        opacity: 0.3,
      });
      const placeholder = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
      placeholder.position.set(0, 10, 0);
      placeholder.userData.isBuilding = true;
      sceneRef.current.add(placeholder);
    }
    
  }, [buildings]);
  
  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Controls overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setIsRotating(!isRotating)}
          className={`px-3 py-2 rounded-lg shadow transition ${
            isRotating 
              ? 'bg-indigo-600 text-white' 
              : 'bg-white text-gray-700'
          }`}
        >
          {isRotating ? '⏸ Pause Rotation' : '▶ Auto Rotate'}
        </button>
        
        <button
          onClick={() => {
            if (cameraRef.current) {
              cameraRef.current.position.set(50, 50, 50);
              cameraRef.current.lookAt(0, 10, 0);
            }
          }}
          className="px-3 py-2 bg-white text-gray-700 rounded-lg shadow hover:bg-gray-50 transition"
        >
          🔄 Reset View
        </button>
      </div>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 rounded-lg shadow p-3">
        <div className="text-sm font-medium mb-2">Unit Types</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ffe082' }} />
            <span>1 RK</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#4fc3f7' }} />
            <span>1 BHK</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#66bb6a' }} />
            <span>2 BHK</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ff8a65' }} />
            <span>3 BHK</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#e57373' }} />
            <span>4 BHK</span>
          </div>
        </div>
      </div>
      
      {/* Instructions */}
      <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-3 py-2 rounded">
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
};
