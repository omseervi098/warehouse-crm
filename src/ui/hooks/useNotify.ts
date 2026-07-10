import toast from 'react-hot-toast';

type NotifyOptions = {
  type: 'success' | 'error' | 'loading';
  message: string;
  id?: string;
};

export const useNotify = () => {
  const notify = ({ type, message, id }: NotifyOptions) => {
    switch (type) {
      case 'success':
        return toast.success(message, { id });
      case 'error':
        return toast.error(message, { id });
      case 'loading':
        return toast.loading(message, { id });
      default:
        return toast(message, { id });
    }
  };

  return notify;
};
