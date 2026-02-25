import { useState, useCallback } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface FileUploaderProps {
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
}

export function FileUploader({ onUpload, uploading }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<Map<string, 'uploading' | 'success' | 'error'>>(new Map());

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );

    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      );
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (file: File) => {
    setUploadStatus(prev => new Map(prev).set(file.name, 'uploading'));
    try {
      await onUpload(file);
      setUploadStatus(prev => new Map(prev).set(file.name, 'success'));
    } catch {
      setUploadStatus(prev => new Map(prev).set(file.name, 'error'));
    }
  };

  const uploadAll = async () => {
    for (const file of files) {
      if (uploadStatus.get(file.name) !== 'success') {
        await uploadFile(file);
      }
    }
  };

  const getStatusIcon = (status?: 'uploading' | 'success' | 'error') => {
    switch (status) {
      case 'uploading':
        return <Loader size={16} className="spin" />;
      case 'success':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'error':
        return <AlertCircle size={16} className="text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="file-uploader">
      <div
        className={`dropzone ${isDragging ? 'dragging' : ''} ${uploading ? 'disabled' : ''}`}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload size={32} />
        <p>Arrastra archivos PDF aquí</p>
        <span>o</span>
        <label className="file-select">
          Seleccionar archivos
          <input
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </label>
      </div>

      {files.length > 0 && (
        <div className="file-list">
          {files.map((file, index) => (
            <div key={index} className="file-item">
              <FileText size={18} />
              <span className="file-name">{file.name}</span>
              <span className="file-size">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
              {getStatusIcon(uploadStatus.get(file.name))}
              <button
                className="remove-file"
                onClick={() => removeFile(index)}
                disabled={uploading}
              >
                <X size={16} />
              </button>
            </div>
          ))}

          <div className="upload-actions">
            <button 
              className="upload-btn"
              onClick={uploadAll}
              disabled={uploading || files.every(f => uploadStatus.get(f.name) === 'success')}
            >
              {uploading ? 'Subiendo...' : 'Subir todos'}
            </button>
            <button 
              className="clear-btn"
              onClick={() => {
                setFiles([]);
                setUploadStatus(new Map());
              }}
              disabled={uploading}
            >
              Limpiar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
