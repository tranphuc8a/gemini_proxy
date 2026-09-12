import React, { Component, type ReactNode } from 'react';
import { Result, Button } from 'antd';
import i18n from '../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // A class component cannot use the useTranslation hook, and this renders
      // outside the provider anyway, so read from the i18n instance directly.
      const t = i18n.t.bind(i18n);
      return (
        <div className="error-boundary">
          <Result
            status="error"
            title={t('common.error')}
            subTitle={this.state.error?.message || t('errors.unexpected')}
            extra={
              <Button type="primary" onClick={this.handleReset}>
                {t('errors.reload')}
              </Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}
